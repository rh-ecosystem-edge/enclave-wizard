package netbox

import "github.com/rh-ecosystem-edge/enclave-wizard/internal/models"

type MockClient struct {
	connected bool
}

func NewMockClient() *MockClient { return &MockClient{} }

var mockSites = []models.NetboxSite{
	{ID: 1, Name: "Raleigh DC", Slug: "rdu", Region: "US-East", Facility: "RDU-1", ASN: 65001, Status: "active"},
	{ID: 2, Name: "Boston DC", Slug: "bos", Region: "US-East", Facility: "BOS-1", ASN: 65003, Status: "active"},
}

var mockRacks = []models.NetboxRack{
	{ID: 1, Name: "RDU-A1", Site: "Raleigh DC", UHeight: 42, Devices: 5, UtilPct: 71.4},
	{ID: 2, Name: "RDU-B1", Site: "Raleigh DC", UHeight: 42, Devices: 4, UtilPct: 47.6},
	{ID: 3, Name: "BOS-C1", Site: "Boston DC", UHeight: 42, Devices: 4, UtilPct: 42.8},
}

// NetBox knows: srv-rdu-a-01, a-02, srv-rdu-b-01, b-02, b-03, srv-bos-a-01, a-02, a-03
var mockDevices = []models.NetboxDevice{
	{ID: 1, Name: "srv-rdu-a-01", DeviceType: "DGX H100", Manufacturer: "NVIDIA", Role: "gpu-server", Site: "Raleigh DC", Rack: "RDU-A1", Position: 1, SerialNumber: "DGX-RDU-A01", Status: "active", PrimaryIP: "10.10.1.100/24", Tags: []string{"gpu", "h100"}},
	{ID: 2, Name: "srv-rdu-a-02", DeviceType: "DGX H100", Manufacturer: "NVIDIA", Role: "gpu-server", Site: "Raleigh DC", Rack: "RDU-A1", Position: 11, SerialNumber: "DGX-RDU-A02", Status: "active", PrimaryIP: "10.10.1.101/24", Tags: []string{"gpu", "h100"}},
	{ID: 5, Name: "srv-rdu-b-01", DeviceType: "DGX H100", Manufacturer: "NVIDIA", Role: "gpu-server", Site: "Raleigh DC", Rack: "RDU-B1", Position: 1, SerialNumber: "DGX-RDU-B01", Status: "active", PrimaryIP: "10.10.2.100/24", Tags: []string{"gpu", "h100"}},
	{ID: 6, Name: "srv-rdu-b-02", DeviceType: "DGX H100", Manufacturer: "NVIDIA", Role: "gpu-server", Site: "Raleigh DC", Rack: "RDU-B1", Position: 11, SerialNumber: "DGX-RDU-B02", Status: "active", PrimaryIP: "10.10.2.101/24", Tags: []string{"gpu", "h100"}},
	{ID: 7, Name: "srv-rdu-b-03", DeviceType: "ProLiant DL380 Gen10 Plus", Manufacturer: "HPE", Role: "infra-server", Site: "Raleigh DC", Rack: "RDU-B1", Position: 21, SerialNumber: "HPE-RDU-B03", Status: "active", PrimaryIP: "10.10.2.102/24", Tags: []string{"infra"}},
	{ID: 8, Name: "srv-bos-a-01", DeviceType: "DGX H100", Manufacturer: "NVIDIA", Role: "gpu-server", Site: "Boston DC", Rack: "BOS-C1", Position: 1, SerialNumber: "DGX-BOS-A01", Status: "active", PrimaryIP: "10.20.1.100/24", Tags: []string{"gpu", "h100"}},
	{ID: 9, Name: "srv-bos-a-02", DeviceType: "DGX H100", Manufacturer: "NVIDIA", Role: "gpu-server", Site: "Boston DC", Rack: "BOS-C1", Position: 11, SerialNumber: "DGX-BOS-A02", Status: "active", PrimaryIP: "10.20.1.101/24", Tags: []string{"gpu", "h100"}},
	{ID: 10, Name: "srv-bos-a-03", DeviceType: "ProLiant DL380 Gen10 Plus", Manufacturer: "HPE", Role: "infra-server", Site: "Boston DC", Rack: "BOS-C1", Position: 21, SerialNumber: "HPE-BOS-A03", Status: "planned", Tags: []string{"infra", "planned"}},
	// Switches
	{ID: 11, Name: "sw-rdu-a-spine-01", DeviceType: "Spectrum-4 SN5600", Manufacturer: "NVIDIA", Role: "spine", Site: "Raleigh DC", Rack: "RDU-A1", Position: 40, Status: "active"},
	{ID: 12, Name: "sw-rdu-a-leaf-01", DeviceType: "Spectrum-4 SN5400", Manufacturer: "NVIDIA", Role: "leaf", Site: "Raleigh DC", Rack: "RDU-A1", Position: 38, Status: "active"},
	{ID: 13, Name: "sw-rdu-a-leaf-02", DeviceType: "Spectrum-4 SN5400", Manufacturer: "NVIDIA", Role: "leaf", Site: "Raleigh DC", Rack: "RDU-A1", Position: 36, Status: "active"},
	{ID: 14, Name: "sw-rdu-b-leaf-01", DeviceType: "Spectrum-4 SN5400", Manufacturer: "NVIDIA", Role: "leaf", Site: "Raleigh DC", Rack: "RDU-B1", Position: 40, Status: "active"},
	{ID: 15, Name: "sw-bos-a-spine-01", DeviceType: "Spectrum-4 SN5600", Manufacturer: "NVIDIA", Role: "spine", Site: "Boston DC", Rack: "BOS-C1", Position: 40, Status: "active"},
	{ID: 16, Name: "sw-bos-a-leaf-01", DeviceType: "Spectrum-4 SN5400", Manufacturer: "NVIDIA", Role: "leaf", Site: "Boston DC", Rack: "BOS-C1", Position: 38, Status: "active"},
}

var mockPrefixes = []models.NetboxPrefix{
	{ID: 1, Prefix: "10.10.0.0/16", Status: "container", Site: "Raleigh DC", Role: "supernet", Tenant: "Infrastructure"},
	{ID: 2, Prefix: "10.10.1.0/24", Status: "active", Site: "Raleigh DC", VRF: "mgmt", Role: "management", Tenant: "Infrastructure"},
	{ID: 3, Prefix: "10.10.2.0/24", Status: "active", Site: "Raleigh DC", VRF: "mgmt", Role: "management", Tenant: "Infrastructure"},
	{ID: 4, Prefix: "10.10.10.0/24", Status: "active", Site: "Raleigh DC", VRF: "tenant-a", Role: "compute", Tenant: "OSAC"},
	{ID: 5, Prefix: "10.10.20.0/24", Status: "active", Site: "Raleigh DC", VRF: "tenant-a", Role: "compute", Tenant: "OSAC"},
	{ID: 6, Prefix: "10.20.0.0/16", Status: "container", Site: "Boston DC", Role: "supernet", Tenant: "Infrastructure"},
	{ID: 7, Prefix: "10.20.1.0/24", Status: "active", Site: "Boston DC", VRF: "mgmt", Role: "management", Tenant: "Infrastructure"},
	{ID: 8, Prefix: "10.20.10.0/24", Status: "active", Site: "Boston DC", VRF: "tenant-a", Role: "compute", Tenant: "OSAC"},
}

var mockVRFs = []models.NetboxVRF{
	{ID: 1, Name: "mgmt", RD: "65001:100"},
	{ID: 2, Name: "tenant-a", RD: "65001:200"},
}

func (c *MockClient) Connect(_ models.NetboxConnectRequest) (*models.NetboxConnectResponse, error) {
	c.connected = true
	return &models.NetboxConnectResponse{
		Connected:   true,
		Endpoint:    "https://netbox.example.com",
		SiteCount:   len(mockSites),
		DeviceCount: len(mockDevices),
		PrefixCount: len(mockPrefixes),
	}, nil
}

func (c *MockClient) Disconnect() { c.connected = false }

func (c *MockClient) Inventory() (*models.NetboxInventory, error) {
	if !c.connected {
		return &models.NetboxInventory{}, nil
	}
	return &models.NetboxInventory{
		Sites:    mockSites,
		Devices:  mockDevices,
		Racks:    mockRacks,
		Prefixes: mockPrefixes,
		VRFs:     mockVRFs,
	}, nil
}
