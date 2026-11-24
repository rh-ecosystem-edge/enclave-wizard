---
name: smoke-test
description: Quick smoke test for the wizard UI — run after modifying frontend code, before committing. Checks build, startup, API proxy, and runtime errors.
---

# Enclave Wizard UI Smoke Test

Run after modifying files under `ui/apps/wizard/src/`, after regenerating the API client, or before committing UI changes.

## Steps

### 1. Run unit tests

```bash
cd ui && podman run --rm -v $(pwd):/app:z -w /app node:24-alpine sh -c "corepack enable && yarn install && yarn workspace @enclave-wizard-ui/wizard test"
```

All tests must pass.

### 2. Start the stack

```bash
cd ui && make fix-selinux && UID=$(id -u) GID=$(id -g) podman-compose up --build -d
```

Wait 6 seconds for containers to start.

### 3. Check UI serves HTTP 200

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001
```

Expected: `200`.

### 4. Check API serves HTTP 200

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/defaults
```

Expected: `200`.

### 5. Check Vite proxy (UI -> API)

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/defaults
```

Expected: `200`.

### 6. Check OpenAPI schema

```bash
curl -s http://localhost:3001/openapi.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('schemas:', len(d.get('components',{}).get('schemas',{})))"
```

Expected: `schemas: N` where N > 0.

### 7. Check HTML shell loads

```bash
curl -s http://localhost:3001/wizard | grep -c "root"
```

Expected: at least 1.

### 8. Check container logs for errors

```bash
podman logs ui_wizard-ui_1 2>&1 | grep -i "error\|EACCES\|fail" | grep -v "hmr\|pre-transform" | tail -5
```

Expected: no output.

### 9. Stop the stack

```bash
cd ui && podman-compose down
```

## Quick one-liner

```bash
cd ui && podman run --rm -v $(pwd):/app:z -w /app node:24-alpine sh -c "corepack enable && yarn install && yarn workspace @enclave-wizard-ui/wizard test" && make fix-selinux && UID=$(id -u) GID=$(id -g) podman-compose up --build -d && sleep 6 && curl -sf http://localhost:3001 > /dev/null && curl -sf http://localhost:3001/api/v1/defaults > /dev/null && echo "SMOKE TEST PASSED" || echo "SMOKE TEST FAILED"
```
