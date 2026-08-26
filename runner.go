package main

import (
	"log/slog"

	"github.com/rh-ecosystem-edge/enclave-wizard/internal/runner"
)

func initRunner(opts *Options, enclaveDir string) (runner.Runner, error) {
	real, err := runner.NewAnsibleRunner(enclaveDir, opts.AnsibleBinDir)
	if err != nil {
		slog.Warn("task runner unavailable, tasks API disabled", "error", err)
		return applyRunnerMode(opts, nil, enclaveDir)
	}
	if err := real.Recover(); err != nil {
		slog.Warn("task recovery failed", "error", err)
	}
	return applyRunnerMode(opts, real, enclaveDir)
}
