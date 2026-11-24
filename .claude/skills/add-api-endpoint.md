---
name: add-api-endpoint
description: Add a new REST API endpoint using the huma framework — handler struct, request/response types, registration, and TypeScript client regeneration.
---

# Add an API Endpoint

## 1. Define request/response types

File: `internal/api/<handler>.go`

```go
type MyRequest struct {
    Name string `path:"name" doc:"Resource name"`
}

type MyResponse struct {
    Body struct {
        Result string `json:"result" doc:"The result"`
    }
}
```

Tags: `path:`, `query:`, `header:`, `doc:`.

## 2. Implement handler

```go
type MyHandler struct { /* deps */ }

func (h *MyHandler) Register(api huma.API) {
    huma.Register(api, huma.Operation{
        Method:  http.MethodGet,
        Path:    "/api/v1/my-resource/{name}",
        Summary: "Get a resource",
        Tags:    []string{"My Resources"},
    }, h.getResource)
}

func (h *MyHandler) getResource(ctx context.Context, input *MyRequest) (*MyResponse, error) {
    return &MyResponse{Body: struct{ Result string `json:"result" doc:"The result"` }{Result: "hello"}}, nil
}
```

## 3. Wire up in main.go

```go
myHandler := &api.MyHandler{/* deps */}
myHandler.Register(humaAPI)
```

All `/api/v1/*` paths get auth middleware automatically (except login/mode/version).

## 4. For config CRUD, use the generic helper

```go
registerSection[models.MySection](api, cfg, "my-section",
    func(c *models.EnclaveConfig) *models.MySection { return &c.MySection },
    func(c *models.EnclaveConfig, s *models.MySection) { c.MySection = *s },
)
```

## 5. Regenerate TypeScript client

```bash
make dev &
curl -sk https://localhost:3443/openapi.yaml -o ui/packages/api-client/api/openapi.yaml
kill %1
cd ui && make api-client
```

## 6. Verify

```bash
make test
curl -sk https://localhost:3443/api/v1/my-resource/test
```

See `docs/contributing/how-to/add-api-endpoint.md` for the full guide.
