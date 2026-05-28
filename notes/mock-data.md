# Mock Data Matrix

Which servers exist in which discovery provider. This simulates a realistic
environment where infrastructure is registered in different systems at
different stages of deployment.

## Server-to-Provider Matrix

| Server | Netris | NICo | OpenStack | NetBox | Type | Notes |
|--------|:------:|:----:|:---------:|:------:|------|-------|
| srv-rdu-a-01 | x | x | x | x | DGX H100 | Well-managed, in all systems |
| srv-rdu-a-02 | x | x | x | x | DGX H100 | Well-managed, in all systems |
| srv-rdu-a-03 | x | x | | | DGX H100 | In network fabric + GPU mgmt, not yet in Ironic or DCIM |
| srv-rdu-a-04 | x | | | | Infra | Only in Netris, infra node on the fabric |
| srv-rdu-b-01 | x | x | | x | DGX H100 | In fabric, GPU mgmt, and DCIM — not Ironic-enrolled |
| srv-rdu-b-02 | x | x | | x | DGX H100 | In fabric, GPU mgmt, and DCIM — not Ironic-enrolled |
| srv-rdu-b-03 | | | x | x | Infra | New Ironic node, already in DCIM |
| srv-rdu-b-04 | | | x | | Infra | Just racked, only enrolled in Ironic (state: enroll) |
| srv-bos-a-01 | x | | x | x | DGX H100 | No NICo at Boston site yet |
| srv-bos-a-02 | | x | | x | DGX H100 | NICo-managed, not in Netris fabric or Ironic |
| srv-bos-a-03 | | | | x | Infra | Planned node, only in DCIM (status: planned) |

## What Each Provider Contributes

| Provider | Unique data it adds | Servers it knows |
|----------|-------------------|-----------------|
| **Netris** | mgmtIP, MAC, site/fabric membership, IPAM subnets, VPCs | 7 servers |
| **NICo** | GPU count/type/health, DPU model/firmware/VFs, NVLink domains, CPU/RAM | 6 servers |
| **OpenStack** | BMC credentials (redfish:// URL + user/pass), provision state, hardware specs from introspection | 5 nodes |
| **NetBox** | Rack position (U-height), serial number, device type, manufacturer, primary IP, VRFs, tags | 8 devices |

## NVLink Domains (NICo only)

| Domain | Servers | GPUs | Constraint |
|--------|---------|------|-----------|
| nvl-rdu-a | srv-rdu-a-01, a-02, a-03 | 24 | Must stay in same AZ |
| nvl-rdu-b | srv-rdu-b-01, b-02 | 16 | Must stay in same AZ |
| nvl-bos-a | srv-bos-a-02 | 8 | Single node domain |

## Sites Per Provider

| Provider | Sites |
|----------|-------|
| **Netris** | rdu-rack-01 (4 srv), rdu-rack-02 (2 srv), bos-rack-01 (1 srv) |
| **OpenStack** | az-rdu-1 (2 nodes), az-rdu-2 (2 nodes), az-bos-1 (1 node) |
| **NetBox** | Raleigh DC (5 srv + switches), Boston DC (3 srv + switches) |
| **NICo** | No site concept — groups by NVLink domain instead |

## Merge Behavior

Nodes are matched by name across providers. When multiple providers know
the same server, their data is merged:

- First provider (by merge order: Netris → NICo → OpenStack → NetBox) creates the node
- Subsequent providers enrich empty fields and append to `sources[]` and `siteIds[]`
- `siteIds[]` accumulates site IDs from all providers, enabling AZ assignment from any source

Example: `srv-rdu-a-01` after full merge:
```
sources: ["netris", "nico", "openstack", "netbox"]
siteIds: [1, 4, 7]  (Netris site 1 + OpenStack site 4 + NetBox site 7)
bmcIp: "10.10.1.11" (from Netris mgmtIP, could be overridden by OpenStack)
bmcUser: "admin" (from OpenStack/Ironic)
gpuCount: 8, gpuType: "H100" (from NICo)
rackPosition: "RDU-A1 U1" (from NetBox)
```
