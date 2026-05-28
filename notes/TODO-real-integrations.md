# TODO: Test Against Real Infrastructure Providers

All four discovery providers currently use mock data. Before shipping, each
needs validation against a real environment.

## Netris

**Confidence: medium** — structure based on Terraform provider docs and Netris
documentation, but no live API testing.

### What to validate

- [ ] Confirm Netris REST API endpoint paths (the mock assumes `/api/v1/` style,
      real Netris may use a different prefix — check the Swagger UI on your
      controller at `https://<controller>/swagger` or similar)
- [ ] Auth flow: mock accepts user/pass, real Netris may return a session token
      that needs to be used for subsequent requests
- [ ] Server inventory: verify that Netris servers expose `mgmtIP` and `macAddress`
      at the API level — these may come from switch port tables or LLDP instead
      of the server object directly
- [ ] The mock conflates Netris `mgmtIP` with BMC/Redfish IP — in reality these
      are different interfaces. Netris likely does not know BMC credentials at all
      (that's Ironic/Metal3 territory). The real client should map `mgmtIP` correctly
      and leave BMC fields empty unless another provider fills them
- [ ] IPAM subnet `purpose` field values — verify the exact enum values Netris uses
      (the mock uses `management`, `common`, `loopback`)
- [ ] VPC creation endpoint — the mock only reads VPCs, creating new ones may need
      tenant ID, site association, etc.

### To implement the real client

Replace `internal/netris/mock.go` with a real HTTP client. The `Client` interface
in `internal/netris/client.go` stays the same — implement `Connect`, `Sites`,
`Inventory`, `VPCs`, and `IPAM` using `net/http` calls to the Netris controller.

Consider using the Netris Terraform provider source code as a reference for
endpoint paths and request/response shapes:
https://github.com/netrisai/terraform-provider-netris

## NVIDIA Carbide / NICo

**Confidence: low** — the GPU/DPU/NVLink concepts are correct, but the API
structure is an educated guess. No public NICo API documentation was found.

### What to validate

- [ ] Actual NICo API endpoint paths and auth mechanism
- [ ] GPU server object shape — fields, naming conventions
- [ ] DPU object shape — the mock uses `BlueField-3` with firmware version
      format `24.40.1000`, verify real format
- [ ] NVLink domain representation — confirm how NICo groups servers into
      NVLink domains (the concept is right but the API shape may differ)
- [ ] Spectrum switch fields — model names (SN5600, SN5400) are real SKUs
      but verify the API returns them in this format

### To implement the real client

This will likely require NVIDIA partnership or access to a NICo controller.
The `Client` interface in `internal/nico/client.go` is minimal (`Connect` +
`Inventory`) — adapt as the real API is discovered.

## OpenStack

**Confidence: high** — the OpenStack APIs are extremely well documented and
stable. Ironic, Nova, Neutron, and Keystone v3 are all standard.

### What to validate

- [ ] Keystone v3 auth token flow (the mock skips actual token exchange)
- [ ] Ironic node list with `detail=True` — confirm all introspection fields
      are populated (some fields require running introspection first)
- [ ] BMC address format — the mock uses `redfish://IP/redfish/v1/Systems/1`,
      which is correct for Redfish driver. IPMI driver uses `ipmi://IP` instead
- [ ] BMC credentials come from a separate Ironic port or node `driver_info`,
      not directly from the node list — the real client needs an extra API call
- [ ] Neutron provider network `physical_network` field — confirm it maps to
      what the mock calls `physicalNet`
- [ ] Nova availability zone host counts — the mock hardcodes these, real
      data comes from `os-availability-zone` API with `?detail=true`

### To implement the real client

Use `gophercloud` (the standard Go OpenStack SDK):
https://github.com/gophercloud/gophercloud

```go
import (
    "github.com/gophercloud/gophercloud/v2"
    "github.com/gophercloud/gophercloud/v2/openstack"
    "github.com/gophercloud/gophercloud/v2/openstack/baremetal/v1/nodes"
    "github.com/gophercloud/gophercloud/v2/openstack/networking/v2/networks"
    "github.com/gophercloud/gophercloud/v2/openstack/compute/v2/availabilityzones"
)
```

## NetBox

**Confidence: high** — NetBox has a full OpenAPI spec and the `go-netbox`
client library.

### What to validate

- [ ] API token auth header format (`Authorization: Token <token>`)
- [ ] Device list pagination — NetBox paginates at 50 by default, the real
      client needs to handle `next` links
- [ ] Prefix hierarchy — the mock filters out `container` status prefixes,
      confirm this is the right behavior
- [ ] Rack utilization calculation — the mock hardcodes percentages, real
      data comes from the rack detail endpoint
- [ ] Device `primary_ip` field — in the real API this is a nested object
      `{"address": "10.0.0.1/24", "family": 4}`, not a plain string

### To implement the real client

Use `go-netbox`:
https://github.com/netbox-community/go-netbox

```go
import (
    "github.com/netbox-community/go-netbox/v4"
)
```

The client auto-generates from NetBox's OpenAPI spec and covers all endpoints.

## Merge logic

The merge functions in `internal/discovery/merge.go` match nodes by `Name`
across providers. This assumes consistent naming across all systems. In
production, consider also matching by:

- BMC IP address (most reliable cross-system identifier)
- Serial number
- MAC address
- A configurable mapping table for environments with inconsistent naming
