CONTAINER_RUNTIME := $(shell command -v podman 2> /dev/null || echo docker)
COMPOSE := $(shell command -v podman-compose 2> /dev/null || echo $(CONTAINER_RUNTIME) compose)
IMAGE_OPENAPI_GEN := quay.io/jkilzi/openapi-generator-cli
TAG_OPENAPI_GEN := 7.18.0
IMAGE_NAME := enclave-wizard-ui
ARGS :=

.PHONY: dev build test test-watch api-client check clean fix-selinux help

# Fix SELinux labels so containers can access volume-mounted source files.
# Uses :z (shared) in compose.yaml, but files touched outside containers
# (e.g. by git, editors, or CI) may lose the label. Run this to fix.
fix-selinux:
	@if command -v chcon >/dev/null 2>&1; then \
		chcon -Rt svirt_sandbox_file_t . 2>/dev/null || true; \
	fi

dev: fix-selinux
	$(COMPOSE) up --build

dev-detach: fix-selinux
	$(COMPOSE) up --build -d

stop:
	$(COMPOSE) down

build:
	$(CONTAINER_RUNTIME) build -f Containerfile -t $(IMAGE_NAME) .

test:
	$(CONTAINER_RUNTIME) run --rm \
		-v $(PWD):/app:z -w /app node:24-alpine \
		sh -c "corepack enable && yarn install && yarn workspace @enclave-wizard-ui/wizard test"

test-watch:
	$(CONTAINER_RUNTIME) run --rm -it \
		-v $(PWD):/app:z -w /app node:24-alpine \
		sh -c "corepack enable && yarn install && yarn workspace @enclave-wizard-ui/wizard test --watch"

check:
	$(CONTAINER_RUNTIME) run --rm \
		-v $(PWD):/app:z -w /app node:24-alpine \
		sh -c "corepack enable && yarn install && yarn check:all"

check-fix:
	$(CONTAINER_RUNTIME) run --rm \
		-v $(PWD):/app:z -w /app node:24-alpine \
		sh -c "corepack enable && yarn install && yarn check:fix:all"

openapi-generator-cli:
	$(CONTAINER_RUNTIME) run \
		--name openapi-generator-cli \
		--rm \
		-v $(PWD):/opt/app-root/src/workspace:z \
		--userns=keep-id \
		-u $$(id -u):$$(id -g) $(IMAGE_OPENAPI_GEN):$(TAG_OPENAPI_GEN) $(ARGS)

generate:
	$(MAKE) openapi-generator-cli ARGS="generate $(ARGS)"

_clean-api-client:
	rm -rf packages/api-client/src packages/api-client/docs

api-client: _clean-api-client
	$(MAKE) generate ARGS="--generator-key api-client"

clean:
	$(COMPOSE) down --rmi local -v 2>/dev/null || true
	rm -rf out node_modules apps/wizard/dist
	yarn workspaces foreach --all -p run clean 2>/dev/null || true

help:
	@echo "Enclave Wizard UI"
	@echo ""
	@echo "Targets:"
	@echo "  dev            Start dev stack (wizard-ui + wizard-api)"
	@echo "  dev-detach     Start dev stack in background"
	@echo "  stop           Stop dev stack"
	@echo "  build          Build production container image"
	@echo "  test           Run tests in container"
	@echo "  test-watch     Run tests in watch mode"
	@echo "  api-client     Regenerate TypeScript API client from OpenAPI spec"
	@echo "  check          Run linter"
	@echo "  check-fix      Run linter with auto-fix"
	@echo "  fix-selinux    Fix SELinux labels on source files"
	@echo "  clean          Remove containers, images, node_modules"

.DEFAULT_GOAL := help
