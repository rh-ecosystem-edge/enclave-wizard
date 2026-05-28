package openstack

import "github.com/rh-ecosystem-edge/enclave-wizard/internal/models"

type MockClient struct {
	connected bool
}

func NewMockClient() *MockClient { return &MockClient{} }

var mockAZs = []models.OSAvailabilityZone{
	{Name: "az-rdu-1", Available: true, HostCount: 2},
	{Name: "az-rdu-2", Available: true, HostCount: 2},
	{Name: "az-bos-1", Available: true, HostCount: 1},
}

// OpenStack/Ironic knows: srv-rdu-a-01, a-02, srv-rdu-b-03, b-04, srv-bos-a-01
var mockNodes = []models.OSBaremetalNode{
	{UUID: "a1b2c3d4-0001", Name: "srv-rdu-a-01", ProvisionState: "available", PowerState: "power on", Driver: "redfish", BmcAddress: "redfish://10.10.1.11/redfish/v1/Systems/1", BmcUser: "admin", BmcPassword: "r3dfi$h", BootMACAddress: "aa:bb:cc:01:01:01", RootDisk: "/dev/sda", CPUs: 128, RAMGB: 2048, DiskGB: 1920, Manufacturer: "NVIDIA", Model: "DGX H100", SerialNumber: "DGX-RDU-A01", AvailabilityZone: "az-rdu-1"},
	{UUID: "a1b2c3d4-0002", Name: "srv-rdu-a-02", ProvisionState: "available", PowerState: "power on", Driver: "redfish", BmcAddress: "redfish://10.10.1.12/redfish/v1/Systems/1", BmcUser: "admin", BmcPassword: "r3dfi$h", BootMACAddress: "aa:bb:cc:01:01:02", RootDisk: "/dev/sda", CPUs: 128, RAMGB: 2048, DiskGB: 1920, Manufacturer: "NVIDIA", Model: "DGX H100", SerialNumber: "DGX-RDU-A02", AvailabilityZone: "az-rdu-1"},
	{UUID: "a1b2c3d4-0007", Name: "srv-rdu-b-03", ProvisionState: "available", PowerState: "power on", Driver: "redfish", BmcAddress: "redfish://10.10.2.13/redfish/v1/Systems/1", BmcUser: "admin", BmcPassword: "r3dfi$h", BootMACAddress: "aa:bb:cc:02:01:03", RootDisk: "/dev/sda", CPUs: 64, RAMGB: 512, DiskGB: 960, Manufacturer: "HPE", Model: "ProLiant DL380 Gen10 Plus", SerialNumber: "HPE-RDU-B03", AvailabilityZone: "az-rdu-2"},
	{UUID: "a1b2c3d4-0008", Name: "srv-rdu-b-04", ProvisionState: "enroll", PowerState: "power off", Driver: "redfish", BmcAddress: "redfish://10.10.2.14/redfish/v1/Systems/1", BmcUser: "admin", BmcPassword: "r3dfi$h", BootMACAddress: "aa:bb:cc:02:01:04", RootDisk: "/dev/sda", CPUs: 64, RAMGB: 512, DiskGB: 960, Manufacturer: "HPE", Model: "ProLiant DL380 Gen10 Plus", SerialNumber: "HPE-RDU-B04", AvailabilityZone: "az-rdu-2"},
	{UUID: "a1b2c3d4-0009", Name: "srv-bos-a-01", ProvisionState: "available", PowerState: "power on", Driver: "redfish", BmcAddress: "redfish://10.20.1.11/redfish/v1/Systems/1", BmcUser: "admin", BmcPassword: "r3dfi$h", BootMACAddress: "aa:bb:cc:03:01:01", RootDisk: "/dev/sda", CPUs: 128, RAMGB: 2048, DiskGB: 1920, Manufacturer: "NVIDIA", Model: "DGX H100", SerialNumber: "DGX-BOS-A01", AvailabilityZone: "az-bos-1"},
}

var mockNetworks = []models.OSNetwork{
	{
		ID: "net-rdu-mgmt", Name: "rdu-management", NetworkType: "flat", PhysicalNet: "physnet-mgmt", Shared: true,
		Subnets: []models.OSSubnet{
			{ID: "sub-rdu1-mgmt", Name: "rdu-rack-01-mgmt", CIDR: "10.10.1.0/24", Gateway: "10.10.1.1", DNS: "10.10.1.53", IPVersion: 4},
			{ID: "sub-rdu2-mgmt", Name: "rdu-rack-02-mgmt", CIDR: "10.10.2.0/24", Gateway: "10.10.2.1", DNS: "10.10.1.53", IPVersion: 4},
		},
	},
	{
		ID: "net-rdu-prov", Name: "rdu-provisioning", NetworkType: "vlan", PhysicalNet: "physnet-prov", Shared: false,
		Subnets: []models.OSSubnet{
			{ID: "sub-rdu-prov", Name: "rdu-provisioning", CIDR: "172.22.0.0/24", Gateway: "172.22.0.1", IPVersion: 4},
		},
	},
	{
		ID: "net-rdu-tenant", Name: "rdu-tenant", NetworkType: "vxlan", Shared: false,
		Subnets: []models.OSSubnet{
			{ID: "sub-rdu-tenant", Name: "rdu-machine-network", CIDR: "10.10.10.0/24", Gateway: "10.10.10.1", DNS: "10.10.1.53", IPVersion: 4},
		},
	},
	{
		ID: "net-bos-mgmt", Name: "bos-management", NetworkType: "flat", PhysicalNet: "physnet-mgmt", Shared: true,
		Subnets: []models.OSSubnet{
			{ID: "sub-bos-mgmt", Name: "bos-rack-01-mgmt", CIDR: "10.20.1.0/24", Gateway: "10.20.1.1", DNS: "10.20.1.53", IPVersion: 4},
		},
	},
}

func (c *MockClient) Connect(_ models.OSConnectRequest) (*models.OSConnectResponse, error) {
	c.connected = true
	return &models.OSConnectResponse{
		Connected:    true,
		Endpoint:     "https://keystone.example.com:5000/v3",
		Project:      "osac-infra",
		AZCount:      len(mockAZs),
		NodeCount:    len(mockNodes),
		NetworkCount: len(mockNetworks),
	}, nil
}

func (c *MockClient) Disconnect() { c.connected = false }

func (c *MockClient) Inventory() (*models.OSInventory, error) {
	if !c.connected {
		return &models.OSInventory{}, nil
	}
	return &models.OSInventory{
		AvailabilityZones: mockAZs,
		BaremetalNodes:    mockNodes,
		Networks:          mockNetworks,
	}, nil
}
