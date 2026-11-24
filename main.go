package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"github.com/danielgtaylor/huma/v2/humacli"

	"github.com/rh-ecosystem-edge/enclave-wizard/internal/api"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/auth"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/config"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/experience"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/logger"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/plugins"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/runner"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/tlscert"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/validation"
)

var (
	wizardVersion  = "dev"
	enclaveVersion = "dev"
)

//go:embed all:ui/apps/wizard/dist
var uiFiles embed.FS

type Options struct {
	HTTPPort      int    `help:"HTTP port (redirects to HTTPS)" default:"3001"`
	HTTPSPort     int    `help:"HTTPS port" default:"3443"`
	TLSCert       string `help:"Path to TLS certificate" default:"/etc/enclave-wizard/tls/server.crt"`
	TLSKey        string `help:"Path to TLS key" default:"/etc/enclave-wizard/tls/server.key"`
	EnclaveDir    string `help:"Path to the Enclave repository root" default:"../enclave"`
	PasswordFile  string `help:"Path to the password file" default:"/etc/enclave-wizard/password"`
	AnsibleBinDir string `help:"Extra directory to search for ansible-runner, prepended to PATH" default:""`
	LogLevel      string `help:"Log level (trace, debug, info, warn, error)" default:"info"`
	NoAuth        bool   `help:"Disable authentication (local development only)" default:"false"`
	DevOptions
}

func SetupAPI(mux *http.ServeMux, enclaveDir string, authStore *auth.Store, opts *Options) (huma.API, runner.Runner, error) {
	apiConfig := huma.DefaultConfig("Enclave Configuration Wizard", "0.1.0")
	apiConfig.Info.Description = "API for managing Enclave deployment configuration files on the Landing Zone."

	apiConfig.Components.SecuritySchemes = map[string]*huma.SecurityScheme{
		"bearer": {
			Type:         "http",
			Scheme:       "bearer",
			BearerFormat: "opaque",
		},
	}

	humaAPI := humago.New(mux, apiConfig)

	reader := config.NewReader(enclaveDir)
	writer := config.NewWriter(enclaveDir)

	loadResult, err := plugins.LoadFromDirWithSchemas(enclaveDir)
	if err != nil {
		slog.Warn("plugin discovery failed, using empty registry", "error", err)
		loadResult = &plugins.LoadResult{Schemas: make(map[string][]byte)}
	}
	registry := plugins.NewRegistry(loadResult.Plugins)
	for name, schema := range loadResult.Schemas {
		registry.SetSchema(name, schema)
	}
	slog.Info("plugins loaded", "count", len(loadResult.Plugins), "schemas", len(loadResult.Schemas))

	runner, err := initRunner(opts, enclaveDir)
	if err != nil {
		return nil, nil, err
	}

	if runner != nil {
		api.NewTasksHandler(runner, registry, reader, writer, enclaveDir).Register(humaAPI)
		api.NewDeployHandler(runner, registry, reader, writer, enclaveDir).Register(humaAPI)
		api.NewStreamHandler(runner).Register(mux)
	}

	validator := validation.NewValidator(enclaveDir, runner)

	experiences, err := experience.LoadFromDir(enclaveDir)
	if err != nil {
		slog.Warn("experience discovery failed", "error", err)
	}
	slog.Info("experiences loaded", "count", len(experiences))

	api.NewAuthHandler(authStore, opts.NoAuth).Register(humaAPI)
	api.NewConfigHandler(reader, writer, validator).Register(humaAPI)
	api.NewDefaultsHandler(enclaveDir).Register(humaAPI)
	api.NewExperiencesHandler(experiences).Register(humaAPI)
	api.NewFileUploadHandler(enclaveDir).Register(humaAPI)
	api.NewPluginsHandler(registry).Register(humaAPI)
	api.NewVersionHandler(wizardVersion, enclaveVersion).Register(humaAPI)

	return humaAPI, runner, nil
}

func setupUIHandler(mux *http.ServeMux) {
	uiFS, err := fs.Sub(uiFiles, "ui/apps/wizard/dist")
	if err != nil {
		slog.Warn("embedded UI not available", "error", err)
		return
	}

	fileServer := http.FileServer(http.FS(uiFS))

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Don't serve UI for API paths — let those 404 naturally
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		if _, err := fs.Stat(uiFS, path); err != nil {
			r.URL.Path = "/"
		}
		fileServer.ServeHTTP(w, r)
	})
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "generate-cert" {
		fs := flag.NewFlagSet("generate-cert", flag.ExitOnError)
		certFlag := fs.String("cert", "/etc/enclave-wizard/tls/server.crt", "Path to write TLS certificate")
		keyFlag := fs.String("key", "/etc/enclave-wizard/tls/server.key", "Path to write TLS key")
		fs.Parse(os.Args[2:])

		if err := tlscert.GenerateSelfSigned(*certFlag, *keyFlag); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
		hostname, _ := os.Hostname()
		fmt.Printf("Generated self-signed TLS certificate\n  cert: %s\n  key:  %s\n  SANs: localhost, 127.0.0.1, %s\n", *certFlag, *keyFlag, hostname)
		return
	}

	if len(os.Args) > 1 && os.Args[1] == "hash-password" {
		if len(os.Args) < 3 {
			fmt.Fprintln(os.Stderr, "Usage: enclave-wizard hash-password <password>")
			os.Exit(1)
		}
		hashed, err := auth.HashPassword(os.Args[2])
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		fmt.Println(hashed)
		return
	}

	cli := humacli.New(func(hooks humacli.Hooks, opts *Options) {
		logger.Init(opts.LogLevel)

		dir := filepath.Dir(opts.PasswordFile)
		os.MkdirAll(dir, 0700)

		authStore := auth.NewStore(opts.PasswordFile)
		generatedPass, err := authStore.Init()
		if err != nil {
			slog.Error("failed to initialize auth", "error", err)
			os.Exit(1)
		}

		if generatedPass != "" {
			fmt.Println("")
			fmt.Println("  ┌────────────────────────────────────────────┐")
			fmt.Printf("  │  Initial admin password: %-18s │\n", generatedPass)
			fmt.Println("  │  (You must change it on first login)       │")
			fmt.Println("  └────────────────────────────────────────────┘")
			fmt.Println("")
			os.WriteFile("/tmp/enclave-wizard-init-pass", []byte(generatedPass+"\n"), 0644)
		}

		mux := http.NewServeMux()
		_, runner, err := SetupAPI(mux, opts.EnclaveDir, authStore, opts)
		if err != nil {
			slog.Error("API setup failed", "error", err)
			os.Exit(1)
		}
		setupUIHandler(mux)

		handler := api.LoggingMiddleware(api.BearerAuthMiddleware(authStore, opts.NoAuth)(mux))

		httpsServer := &http.Server{
			Addr:    fmt.Sprintf(":%d", opts.HTTPSPort),
			Handler: handler,
		}

		hooks.OnStart(func() {
			if err := tlscert.EnsureCert(opts.TLSCert, opts.TLSKey); err != nil {
				slog.Error("TLS certificate error", "error", err)
				os.Exit(1)
			}

			fmt.Printf("Enclave Wizard listening on https://localhost:%d (enclave-dir: %s)\n", opts.HTTPSPort, opts.EnclaveDir)

			// HTTP → HTTPS redirect
			go func() {
				redirectHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					target := fmt.Sprintf("https://%s:%d%s", strings.Split(r.Host, ":")[0], opts.HTTPSPort, r.RequestURI)
					http.Redirect(w, r, target, http.StatusMovedPermanently)
				})
				fmt.Printf("HTTP redirect :%d → :%d\n", opts.HTTPPort, opts.HTTPSPort)
				http.ListenAndServe(fmt.Sprintf(":%d", opts.HTTPPort), redirectHandler)
			}()

			// Graceful shutdown
			go func() {
				sigCh := make(chan os.Signal, 1)
				signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
				<-sigCh

				fmt.Println("\nShutting down...")

				if runner != nil {
					shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
					defer cancel()
					if err := runner.Shutdown(shutdownCtx); err != nil {
						slog.Error("runner shutdown error", "error", err)
					}
				}

				shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				httpsServer.Shutdown(shutdownCtx)
			}()

			if err := httpsServer.ListenAndServeTLS(opts.TLSCert, opts.TLSKey); err != http.ErrServerClosed {
				slog.Error("HTTPS server error", "error", err)
				os.Exit(1)
			}
		})
	})
	cli.Run()
}
