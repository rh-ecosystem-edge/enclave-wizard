package netris

import "github.com/rh-ecosystem-edge/enclave-wizard/internal/models"

type MockClient struct {
	connected bool
}

func NewMockClient() *MockClient {
	return &MockClient{}
}

var mockSites = []models.NetrisSite{
	{ID: 1, Name: "rdu-rack-01", PublicASN: 65001, SiteMesh: "hub", ACLPolicy: "permit", SwitchCount: 3, ServerCount: 4},
	{ID: 2, Name: "rdu-rack-02", PublicASN: 65002, SiteMesh: "spoke", ACLPolicy: "permit", SwitchCount: 1, ServerCount: 3},
	{ID: 3, Name: "bos-rack-01", PublicASN: 65003, SiteMesh: "hub", ACLPolicy: "permit", SwitchCount: 2, ServerCount: 3},
}

var mockServers = []models.NetrisServer{
	{ID: 1, Name: "srv-rdu-a-01", SiteID: 1, SiteName: "rdu-rack-01", Description: "DGX H100 Node", MgmtIP: "10.10.1.11", PortCount: 16, MACAddress: "aa:bb:cc:01:01:01", Labels: map[string]string{"gpu": "h100", "rack": "A1"}},
	{ID: 2, Name: "srv-rdu-a-02", SiteID: 1, SiteName: "rdu-rack-01", Description: "DGX H100 Node", MgmtIP: "10.10.1.12", PortCount: 16, MACAddress: "aa:bb:cc:01:01:02", Labels: map[string]string{"gpu": "h100", "rack": "A1"}},
	{ID: 3, Name: "srv-rdu-a-03", SiteID: 1, SiteName: "rdu-rack-01", Description: "DGX H100 Node", MgmtIP: "10.10.1.13", PortCount: 16, MACAddress: "aa:bb:cc:01:01:03", Labels: map[string]string{"gpu": "h100", "rack": "A2"}},
	{ID: 4, Name: "srv-rdu-a-04", SiteID: 1, SiteName: "rdu-rack-01", Description: "Infra Node", MgmtIP: "10.10.1.14", PortCount: 4, MACAddress: "aa:bb:cc:01:01:04", Labels: map[string]string{"role": "infra", "rack": "A2"}},
	{ID: 5, Name: "srv-rdu-b-01", SiteID: 2, SiteName: "rdu-rack-02", Description: "DGX H100 Node", MgmtIP: "10.10.2.11", PortCount: 16, MACAddress: "aa:bb:cc:02:01:01", Labels: map[string]string{"gpu": "h100", "rack": "B1"}},
	{ID: 6, Name: "srv-rdu-b-02", SiteID: 2, SiteName: "rdu-rack-02", Description: "DGX H100 Node", MgmtIP: "10.10.2.12", PortCount: 16, MACAddress: "aa:bb:cc:02:01:02", Labels: map[string]string{"gpu": "h100", "rack": "B1"}},
	{ID: 7, Name: "srv-rdu-b-03", SiteID: 2, SiteName: "rdu-rack-02", Description: "Infra Node", MgmtIP: "10.10.2.13", PortCount: 4, MACAddress: "aa:bb:cc:02:01:03", Labels: map[string]string{"role": "infra", "rack": "B1"}},
	{ID: 8, Name: "srv-bos-a-01", SiteID: 3, SiteName: "bos-rack-01", Description: "DGX H100 Node", MgmtIP: "10.20.1.11", PortCount: 16, MACAddress: "aa:bb:cc:03:01:01", Labels: map[string]string{"gpu": "h100", "rack": "C1"}},
	{ID: 9, Name: "srv-bos-a-02", SiteID: 3, SiteName: "bos-rack-01", Description: "DGX H100 Node", MgmtIP: "10.20.1.12", PortCount: 16, MACAddress: "aa:bb:cc:03:01:02", Labels: map[string]string{"gpu": "h100", "rack": "C1"}},
	{ID: 10, Name: "srv-bos-a-03", SiteID: 3, SiteName: "bos-rack-01", Description: "Infra Node", MgmtIP: "10.20.1.13", PortCount: 4, MACAddress: "aa:bb:cc:03:01:03", Labels: map[string]string{"role": "infra", "rack": "C1"}},
}

var mockSwitches = []models.NetrisSwitch{
	{ID: 1, Name: "sw-rdu-a-spine-01", SiteID: 1, SiteName: "rdu-rack-01", NOS: "cumulus_linux_5", Role: "spine", PortCount: 32},
	{ID: 2, Name: "sw-rdu-a-leaf-01", SiteID: 1, SiteName: "rdu-rack-01", NOS: "cumulus_linux_5", Role: "leaf", PortCount: 48},
	{ID: 3, Name: "sw-rdu-a-leaf-02", SiteID: 1, SiteName: "rdu-rack-01", NOS: "cumulus_linux_5", Role: "leaf", PortCount: 48},
	{ID: 4, Name: "sw-rdu-b-leaf-01", SiteID: 2, SiteName: "rdu-rack-02", NOS: "cumulus_linux_5", Role: "leaf", PortCount: 48},
	{ID: 5, Name: "sw-bos-a-spine-01", SiteID: 3, SiteName: "bos-rack-01", NOS: "cumulus_linux_5", Role: "spine", PortCount: 32},
	{ID: 6, Name: "sw-bos-a-leaf-01", SiteID: 3, SiteName: "bos-rack-01", NOS: "cumulus_linux_5", Role: "leaf", PortCount: 48},
}

var mockSoftGates = []models.NetrisSoftGate{
	{ID: 1, Name: "sg-rdu-01", SiteID: 1, SiteName: "rdu-rack-01", MainIP: "10.10.1.1", MgmtIP: "10.10.1.2"},
	{ID: 2, Name: "sg-bos-01", SiteID: 3, SiteName: "bos-rack-01", MainIP: "10.20.1.1", MgmtIP: "10.20.1.2"},
}

var mockVPCs = []models.NetrisVPC{
	{ID: 1, Name: "default", TenantID: 1, Tenant: "Admin"},
}

var mockSubnets = []models.NetrisSubnet{
	{ID: 1, Name: "rdu-rack-01-mgmt", Prefix: "10.10.1.0/24", Purpose: "management", SiteID: 1, VPCID: 1, Gateway: "10.10.1.1"},
	{ID: 2, Name: "rdu-rack-02-mgmt", Prefix: "10.10.2.0/24", Purpose: "management", SiteID: 2, VPCID: 1, Gateway: "10.10.2.1"},
	{ID: 3, Name: "rdu-common", Prefix: "10.10.10.0/24", Purpose: "common", SiteID: 1, VPCID: 1, Gateway: "10.10.10.1"},
	{ID: 4, Name: "rdu-loopback", Prefix: "10.10.100.0/24", Purpose: "loopback", SiteID: 1, VPCID: 1},
	{ID: 5, Name: "bos-rack-01-mgmt", Prefix: "10.20.1.0/24", Purpose: "management", SiteID: 3, VPCID: 1, Gateway: "10.20.1.1"},
	{ID: 6, Name: "bos-common", Prefix: "10.20.10.0/24", Purpose: "common", SiteID: 3, VPCID: 1, Gateway: "10.20.10.1"},
	{ID: 7, Name: "bos-loopback", Prefix: "10.20.100.0/24", Purpose: "loopback", SiteID: 3, VPCID: 1},
	{ID: 8, Name: "rdu-rack-02-common", Prefix: "10.10.20.0/24", Purpose: "common", SiteID: 2, VPCID: 1, Gateway: "10.10.20.1"},
}

func (c *MockClient) Connect(_ models.NetrisConnectRequest) (*models.NetrisConnectResponse, error) {
	c.connected = true
	return &models.NetrisConnectResponse{
		Connected:   true,
		Controller:  "netris.example.com",
		SiteCount:   len(mockSites),
		ServerCount: len(mockServers),
		VPCCount:    len(mockVPCs),
	}, nil
}

func (c *MockClient) Sites() ([]models.NetrisSite, error) {
	return mockSites, nil
}

func (c *MockClient) Inventory(siteID *int) (*models.NetrisInventory, error) {
	inv := &models.NetrisInventory{}
	for _, s := range mockServers {
		if siteID == nil || s.SiteID == *siteID {
			inv.Servers = append(inv.Servers, s)
		}
	}
	for _, s := range mockSwitches {
		if siteID == nil || s.SiteID == *siteID {
			inv.Switches = append(inv.Switches, s)
		}
	}
	for _, s := range mockSoftGates {
		if siteID == nil || s.SiteID == *siteID {
			inv.SoftGates = append(inv.SoftGates, s)
		}
	}
	return inv, nil
}

func (c *MockClient) VPCs() ([]models.NetrisVPC, error) {
	return mockVPCs, nil
}

func (c *MockClient) IPAM(siteID *int) (*models.NetrisIPAM, error) {
	ipam := &models.NetrisIPAM{}
	for _, s := range mockSubnets {
		if siteID == nil || s.SiteID == *siteID {
			ipam.Subnets = append(ipam.Subnets, s)
		}
	}
	return ipam, nil
}
