# How to Add an API Endpoint

The API uses [Huma](https://huma.rocks/) on Go's stdlib router. Endpoints are defined as Go structs with struct tags — Huma auto-generates OpenAPI docs and handles validation.

## Handler Pattern

Every handler follows the same structure:

```go
// internal/api/myhandler.go

type MyHandler struct {
    // dependencies (config reader, plugin registry, etc.)
}

type MyRequest struct {
    // Path params, query params, or body fields with huma tags
    Name string `path:"name" doc:"Resource name"`
}

type MyResponse struct {
    Body struct {
        Result string `json:"result" doc:"The result"`
    }
}

func (h *MyHandler) Register(api huma.API) {
    huma.Register(api, huma.Operation{
        Method:      http.MethodGet,
        Path:        "/api/v1/my-resource/{name}",
        Summary:     "Get a resource",
        Description: "Longer description for OpenAPI docs",
        Tags:        []string{"My Resources"},
    }, h.getResource)
}

func (h *MyHandler) getResource(ctx context.Context, input *MyRequest) (*MyResponse, error) {
    // implementation
    return &MyResponse{Body: struct {
        Result string `json:"result" doc:"The result"`
    }{Result: "hello"}}, nil
}
```

## Steps

### 1. Define request/response types

Create or extend a file in `internal/api/`. Request types use huma tags:

| Tag | Purpose | Example |
|-----|---------|---------|
| `path:"name"` | URL path parameter | `/api/v1/things/{name}` |
| `query:"limit"` | Query string parameter | `?limit=10` |
| `header:"X-Custom"` | Request header | |
| `doc:"..."` | OpenAPI description | |

Response types use standard `json` tags. The `Body` field is the JSON response body.

### 2. Implement the handler

Follow the existing patterns in `internal/api/`:
- `config.go` — CRUD for config sections (uses `registerSection[T]()` generic helper)
- `tasks.go` — task management with start/poll/delete
- `files.go` — multipart file upload

### 3. Wire up in main.go

File: `main.go`

Add handler initialization and registration:

```go
myHandler := &api.MyHandler{
    // inject dependencies
}
myHandler.Register(humaAPI)
```

All `/api/v1/*` paths are automatically protected by `BearerAuthMiddleware` (except `/api/v1/auth/login`, `/api/v1/auth/mode`, and `/api/v1/version`).

### 4. Regenerate the TypeScript client

After adding endpoints, regenerate the frontend API client:

```bash
# Start the backend to get the updated OpenAPI spec
make dev &
# Wait for startup, then fetch the spec
curl -sk https://localhost:3443/openapi.yaml -o ui/packages/api-client/api/openapi.yaml
kill %1

# Regenerate TypeScript client
cd ui && make api-client
```

### 5. Use from the frontend

The generated client creates typed API methods in `ui/packages/api-client/src/apis/`. Import and use via the IoC container:

```typescript
// In a hook or component
const api = useInjection<MyApiInterface>(Symbols.MyApi);
const result = await api.getResource({ name: "foo" });
```

### 6. Config section shortcut

For simple CRUD on a config sub-struct, use the generic `registerSection` helper instead of writing a full handler:

```go
// internal/api/config.go
registerSection[models.MySection](api, cfg, "my-section",
    func(c *models.EnclaveConfig) *models.MySection { return &c.MySection },
    func(c *models.EnclaveConfig, s *models.MySection) { c.MySection = *s },
)
```

This registers `GET /api/v1/config/my-section` and `PUT /api/v1/config/my-section` automatically.

## Existing Handlers

| File | Endpoints |
|------|-----------|
| `auth.go` | `/api/v1/auth/*` — login, password change, mode |
| `config.go` | `/api/v1/config/*` — full config CRUD + section endpoints |
| `tasks.go` | `/api/v1/tasks/*`, `/api/v1/deployment/*` — task lifecycle + progress |
| `files.go` | `/api/v1/files` — multipart file upload |
| `defaults.go` | `/api/v1/defaults` — default values |
| `plugins.go` | `/api/v1/plugins` — plugin listing + validation |
| `version.go` | `/api/v1/version` — version info |
