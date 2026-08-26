BINARY := enclave-wizard
GO := go
CONTAINER_RUNTIME := $(shell command -v podman 2> /dev/null || echo docker)
WIZARD_VERSION ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)
# Also used as the git ref (branch, tag, or commit SHA) to clone for deployment — see `make enclave-tarball`.
ENCLAVE_VERSION ?= $(shell git -C ../enclave rev-parse --short HEAD 2>/dev/null || echo main)
LDFLAGS := -w -s -X main.wizardVersion=$(WIZARD_VERSION) -X main.enclaveVersion=$(ENCLAVE_VERSION)

.DEFAULT_GOAL := help
.DELETE_ON_ERROR:

.PHONY: help
help: ## Display this help.
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9\/-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

.PHONY: build build-linux build-ui run test lint clean tidy deploy teardown generate generate-schema enclave-mock clean-enclave-mock run-mock preview deploy-preview bm-emulation bm-emulation-config bm-teardown test-config demo-build demo-start demo-stop demo-restart demo

##@ Build

build-ui: ## Build the frontend (Vite).
	$(CONTAINER_RUNTIME) run --rm -v $(PWD)/ui:/app:z -w /app node:22-alpine \
		sh -c "corepack enable && yarn install && \
		yarn workspace @enclave-wizard-ui/wizard run -T vite build"

build: build-ui ## Build UI + Go binary.
	$(GO) build -ldflags="$(LDFLAGS)" -tags "$(TAGS)" -o $(BINARY) .

build-linux: build-ui
	rm -f $(BINARY)
	$(CONTAINER_RUNTIME) run --rm -v $(PWD):/app:z -w /app golang:latest \
		sh -c "CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags='$(LDFLAGS)' -tags '$(TAGS)' -o $(BINARY) ."

##@ Run

run: build ## Build and run against ../enclave.
	./$(BINARY) --enclave-dir ../enclave --tls-cert hack/tls/server.crt --tls-key hack/tls/server.key

run-demo: build-ui ## Build and run in demo mode (foreground).
	$(GO) build -ldflags="$(LDFLAGS)" -tags dev -o $(BINARY) .
	./$(BINARY) --demo-deploy --enclave-dir ../enclave --tls-cert hack/tls/server.crt --tls-key hack/tls/server.key

preview: build-ui
	$(CONTAINER_RUNTIME) run --rm -v $(PWD):/app:z -w /app golang:latest \
		sh -c "CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags='$(LDFLAGS)' -tags dev -o $(BINARY) ."
	hack/run-preview.sh $(PORT)

##@ Test & Lint

test: ## Run all Go tests with coverage.
	$(GO) test -cover ./...

lint: ## Run go vet.
	$(GO) vet ./...

##@ Maintenance

clean: ## Remove build artifacts.
	rm -f $(BINARY)
	rm -rf ui/apps/wizard/dist

tidy: ## Run go mod tidy.
	$(GO) mod tidy

ENCLAVE_DIR ?= ../enclave

generate-schema: ## Generate Go types from enclave JSON schemas.
	$(GO) run ./cmd/schemagen --enclave-dir $(ENCLAVE_DIR) --output internal/schema/

generate: generate-schema ## Run all code generation.
	$(GO) generate ./...

rpm: build-linux ## Build the enclave-wizard RPM package.
	hack/rpm/build-rpm.sh

update-enclave-overrides: ## Sync plugin defaults from enclave repo into hack/enclave/.
	hack/update-enclave-overrides.sh

ENCLAVE_REPO ?= https://github.com/rh-ecosystem-edge/enclave.git

enclave-tarball: update-enclave-overrides ## Clone enclave at ENCLAVE_VERSION (branch/tag/sha) and package it for deployment.
	ENCLAVE_REPO='$(ENCLAVE_REPO)' ENCLAVE_VERSION='$(ENCLAVE_VERSION)' hack/fetch-enclave.sh

##@ Deploy

deploy-preview:
	@test -n "$(TARGET)" || (echo "Usage: make deploy-preview TARGET=root@host [PORT=3443]" && exit 1)
	hack/deploy-preview.sh $(TARGET) $(PORT)

deploy: rpm enclave-tarball ## Build wizard RPM + enclave tarball, then deploy. TARGET=root@host [AUTH=none] [ENCLAVE_VERSION=<branch/tag/sha>]
	@test -n '$(TARGET)' || (echo "Usage: make deploy TARGET=root@host [AUTH=none]" && exit 1)
	AUTH='$(AUTH)' hack/deploy-wizard '$(TARGET)'

teardown:
	@test -n "$(TARGET)" || (echo "Usage: make teardown TARGET=root@host" && exit 1)
	hack/teardown-wizard $(TARGET)

e2e: rpm
	@test -n "$(TARGET)" || (echo "Usage: make e2e TARGET=root@host" && exit 1)
	hack/e2e/run-e2e.sh --host $(TARGET)

e2e-rerun:
	@test -n "$(TARGET)" || (echo "Usage: make e2e-rerun TARGET=root@host" && exit 1)
	hack/e2e/run-e2e.sh --host $(TARGET) --skip-deploy --skip-teardown

e2e-browser:
	@test -n "$(WIZARD_URL)" || (echo "Usage: make e2e-browser WIZARD_URL=https://localhost:3443" && exit 1)
	cd ui/apps/wizard && WIZARD_URL=$(WIZARD_URL) yarn e2e

e2e-full: rpm
	@test -n "$(TARGET)" || (echo "Usage: make e2e-full TARGET=root@host" && exit 1)
	hack/e2e/run-e2e.sh --host $(TARGET)
	$(MAKE) e2e-browser WIZARD_URL=https://$(shell echo $(TARGET) | cut -d@ -f2):3443

bm-emulation:
	@test -n "$(TARGET)" || (echo "Usage: make bm-emulation TARGET=root@host" && exit 1)
	hack/infra/bm-emulation.sh --host $(TARGET)

test-config:
	@test -n '$(TARGET)' || (echo "Usage: make test-config TARGET=root@host PULL_SECRET=/path/to/pull-secret.json MANIFEST=/path/to/manifest.zip" && exit 1)
	@test -n '$(PULL_SECRET)' || (echo "Usage: make test-config TARGET=root@host PULL_SECRET=/path/to/pull-secret.json MANIFEST=/path/to/manifest.zip" && exit 1)
	@test -n '$(MANIFEST)' || (echo "Usage: make test-config TARGET=root@host PULL_SECRET=/path/to/pull-secret.json MANIFEST=/path/to/manifest.zip" && exit 1)
	hack/infra/test-config.sh --host '$(TARGET)' --pull-secret '$(PULL_SECRET)' --manifest '$(MANIFEST)'

bm-emulation-config:
	@test -n '$(TARGET)' || (echo "Usage: make bm-emulation-config TARGET=root@host PULL_SECRET=/path/to/pull-secret.json" && exit 1)
	@test -n '$(PULL_SECRET)' || (echo "Usage: make bm-emulation-config TARGET=root@host PULL_SECRET=/path/to/pull-secret.json" && exit 1)
	hack/infra/bm-emulation-config.sh --host '$(TARGET)' --pull-secret '$(PULL_SECRET)'

save-remote-config:
	@test -n '$(TARGET)' || (echo "Usage: make save-remote-config TARGET=root@host" && exit 1)
	hack/infra/save-remote-config.sh --host '$(TARGET)'

restore-remote-config:
	@test -n '$(TARGET)' || (echo "Usage: make restore-remote-config TARGET=root@host" && exit 1)
	hack/infra/restore-remote-config.sh --host '$(TARGET)'

sanity-check:
	@test -n '$(TARGET)' || (echo "Usage: make sanity-check TARGET=root@host" && exit 1)
	hack/infra/sanity-check.sh --host '$(TARGET)'

bm-teardown:
	@test -n "$(TARGET)" || (echo "Usage: make bm-teardown TARGET=root@host" && exit 1)
	hack/infra/bm-teardown.sh --host $(TARGET)

ENCLAVE_MOCK_BRANCH ?= main
ENCLAVE_MOCK_REPO ?= git@github.com:rccrdpccl/enclave.git

enclave-mock:
	python3 hack/generate-enclave-mock.py \
		--branch $(ENCLAVE_MOCK_BRANCH) \
		--repo $(ENCLAVE_MOCK_REPO)

clean-enclave-mock:
	rm -rf enclave-mock

run-mock: build
	./$(BINARY) --enclave-dir enclave-mock \
		--tls-cert hack/tls/server.crt --tls-key hack/tls/server.key

dev: build-ui ## Build and run dev mode (no-auth, enclave-mock, foreground).
	$(GO) build -ldflags="$(LDFLAGS)" -tags dev -o $(BINARY) .
	./$(BINARY) --no-auth --enclave-dir enclave-mock \
		--password-file /tmp/enclave-wizard-dev-pass \
		--tls-cert hack/tls/server.crt --tls-key hack/tls/server.key

##@ Demo Environment

demo-build: build-ui ## Build the binary for demo mode.
	$(GO) build -ldflags="$(LDFLAGS)" -tags dev -o $(BINARY) .

demo-start: ## Start demo in background. SPEED=10 PORT=3443 ENCLAVE_DIR=hack/enclave
	hack/demo-start.sh

demo-stop: ## Stop the background demo.
	hack/demo-stop.sh

demo-restart: demo-stop demo-start ## Restart the demo.

demo: demo-build demo-start ## Build and start demo (one command).
