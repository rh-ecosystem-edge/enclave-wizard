---
name: go-idioms
description: Preferred Go idioms for enclave-wizard. Use when writing, editing, or reviewing Go code in this repository.
---

# Go idioms

## No `else`

`else` is never necessary. Prefer early return, `continue`, or restructure the
logic so the happy path stays unindented.

```go
// Avoid
if err != nil {
    return err
} else {
    doWork()
}

// Prefer
if err != nil {
    return err
}
doWork()
```

```go
// Avoid
for _, item := range items {
    if item.OK {
        process(item)
    } else {
        continue
    }
}

// Prefer
for _, item := range items {
    if !item.OK {
        continue
    }
    process(item)
}
```
