BINARY := enclave-wizard
GO := go
CONTAINER_RUNTIME := $(shell command -v podman 2> /dev/null || echo docker)

.PHONY: build build-linux build-ui run test lint clean tidy deploy teardown generate

build-ui:
	$(CONTAINER_RUNTIME) run --rm -v $(PWD)/ui:/app:z -w /app node:22-alpine \
		sh -c "corepack enable && yarn install && \
		yarn workspace @enclave-wizard-ui/wizard run -T vite build"

build: build-ui
	$(GO) build -ldflags="-w -s" -tags "$(TAGS)" -o $(BINARY) .

build-linux: build-ui
	$(CONTAINER_RUNTIME) run --rm -v $(PWD):/app:z -w /app golang:latest \
		sh -c "CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags='-w -s' -tags '$(TAGS)' -o $(BINARY) ."

run: build
	./$(BINARY) --enclave-dir ../enclave --tls-cert hack/tls/server.crt --tls-key hack/tls/server.key

run-demo: build-ui
	$(GO) build -ldflags="-w -s" -tags dev -o $(BINARY) .
	./$(BINARY) --demo-deploy --enclave-dir ../enclave --tls-cert hack/tls/server.crt --tls-key hack/tls/server.key

test:
	$(GO) test -cover ./...

lint:
	$(GO) vet ./...

clean:
	rm -f $(BINARY)
	rm -rf ui/apps/wizard/dist

tidy:
	$(GO) mod tidy

generate:
	$(GO) generate ./...

rpm: build-linux
	hack/rpm/build-rpm.sh

deploy: build-linux
	@test -n "$(TARGET)" || (echo "Usage: make deploy TARGET=root@host [LZ_IP=x.x.x.x]" && exit 1)
	hack/deploy-wizard $(TARGET) $(if $(LZ_IP),--lz-ip $(LZ_IP))

teardown:
	@test -n "$(TARGET)" || (echo "Usage: make teardown TARGET=root@host" && exit 1)
	hack/teardown-wizard $(TARGET)

e2e: rpm
	@test -n "$(TARGET)" || (echo "Usage: make e2e TARGET=root@host [LZ_IP=x.x.x.x]" && exit 1)
	hack/e2e/run-e2e.sh --host $(TARGET) $(if $(LZ_IP),--lz-ip $(LZ_IP))

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
