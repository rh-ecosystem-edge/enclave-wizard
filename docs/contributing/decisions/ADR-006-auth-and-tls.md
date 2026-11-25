# ADR-006: Local admin auth and HTTPS transport

## Status

Accepted

## Date

2026-11-25

## Context

The wizard runs on a Landing Zone host on an operator LAN. It must keep
casual or network-adjacent access from reading or writing Enclave config and
starting deploys. It is a bootstrap tool, not a multi-tenant control plane.

Operator-facing detail lives in [authentication.md](../../authentication.md).
This ADR records the architectural bets.

## Decision

### Authentication

1. **Single local admin** — Username is fixed as `admin`. There is no user
   directory and no external Identity Provider (IdP) or cluster SSO.
2. **Password file** — One bcrypt password hash on disk (default
   `/etc/enclave-wizard/password`). Missing/empty file → generate a random
   password once, store the hash, print plaintext for the operator.
3. **Opaque bearer tokens** — Login returns a random opaque token (not a JWT).
   Clients send `Authorization: Bearer …`. Tokens live in server memory only
   (24h lifetime); process restart or password change invalidates them.
4. **Forced password change (UI)** — After first login with a generated
   password, the UI requires a change before entering the wizard. The API still
   accepts the token for `/api/v1/*` until the password changes.
5. **`--no-auth`** — Disables bearer checks for local development only
   (`make dev`, demo, and similar). Must not be used on shared or production
   hosts.

### Transport

1. **HTTPS by default** — Browser traffic uses HTTPS (default port `3443`).
   HTTP redirects to HTTPS.
2. **TLS material** — Configurable cert/key paths (defaults under
   `/etc/enclave-wizard/tls/`). Local/dev flows may generate self-signed certs.
3. **Trust boundary** — Auth protects the API; TLS protects the channel. Both
   are required for a normal operator deployment.

## Alternatives Considered

### External IdP / OIDC

- Pros: Central identity; familiar enterprise login
- Cons: LZ bootstrap often happens before IdP integration; heavier ops
- Rejected (as-built): Local admin only for a bootstrap tool

### JWT access tokens

- Pros: Stateless validation; standard libraries
- Cons: Need signing keys and revocation story; current store is in-memory
  opaque tokens tied to password change
- Rejected (as-built): Opaque bearer tokens in process memory

### HTTP-only on the LZ LAN

- Pros: Simpler cert management
- Cons: Credentials and config traverse the LAN in cleartext
- Rejected (as-built): HTTPS with redirect from HTTP

### Enforce must-change-password in the API middleware

- Pros: Clients cannot skip the UI gate
- Cons: Not how the as-built API behaves today
- Not chosen (as-built): UI enforces; API documents `mustChangePassword` on
  login. Tightening API enforcement would be a deliberate follow-up.

## Consequences

- No RBAC, no multi-user audit identity beyond the single admin.
- Operators must secure the password file and treat first-boot plaintext
  carefully (including any temporary init password file).
- API clients must handle 401 (logout/re-login) and must not rely on tokens
  surviving restarts.
- Adding SSO or multi-user auth supersedes this ADR.
- Disabling TLS for production would violate the transport half of this
  decision.
