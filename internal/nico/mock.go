package nico

import (
	"fmt"

	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
)

type MockClient struct {
	connected bool
}

func NewMockClient() *MockClient { return &MockClient{} }

func makeGPUs(count int, gpuType string, memGB int) []models.NicoGPU {
	gpus := make([]models.NicoGPU, count)
	for i := range gpus {
		gpus[i] = models.NicoGPU{Index: i, Type: gpuType, MemoryGB: memGB, Health: "Healthy"}
	}
	return gpus
}

func makeDPUs(count int, mgmtBase string, bmcBase string) []models.NicoDPU {
	dpus := make([]models.NicoDPU, count)
	for i := range dpus {
		dpus[i] = models.NicoDPU{
			Name:     fmt.Sprintf("bf3-%d", i),
			Model:    "BlueField-3",
			Firmware: "24.40.1000",
			VFCount:  16,
			MgmtIP:   fmt.Sprintf("%s%d", mgmtBase, i+1),
			BmcIP:    fmt.Sprintf("%s%d", bmcBase, i+1),
		}
	}
	return dpus
}

// NICo knows: srv-rdu-a-01, a-02, a-03, srv-rdu-b-01, b-02, srv-bos-a-02
var mockServers = []models.NicoServer{
	{Name: "srv-rdu-a-01", Model: "DGX H100", SerialNumber: "DGX-RDU-A01", GPUs: makeGPUs(8, "H100", 80), DPUs: makeDPUs(2, "10.10.1.10", "10.10.1.20"), NVLinkDomain: "nvl-rdu-a", CPUs: 128, RAMGB: 2048},
	{Name: "srv-rdu-a-02", Model: "DGX H100", SerialNumber: "DGX-RDU-A02", GPUs: makeGPUs(8, "H100", 80), DPUs: makeDPUs(2, "10.10.1.30", "10.10.1.40"), NVLinkDomain: "nvl-rdu-a", CPUs: 128, RAMGB: 2048},
	{Name: "srv-rdu-a-03", Model: "DGX H100", SerialNumber: "DGX-RDU-A03", GPUs: makeGPUs(8, "H100", 80), DPUs: makeDPUs(2, "10.10.1.50", "10.10.1.60"), NVLinkDomain: "nvl-rdu-a", CPUs: 128, RAMGB: 2048},
	{Name: "srv-rdu-b-01", Model: "DGX H100", SerialNumber: "DGX-RDU-B01", GPUs: makeGPUs(8, "H100", 80), DPUs: makeDPUs(2, "10.10.2.10", "10.10.2.20"), NVLinkDomain: "nvl-rdu-b", CPUs: 128, RAMGB: 2048},
	{Name: "srv-rdu-b-02", Model: "DGX H100", SerialNumber: "DGX-RDU-B02", GPUs: makeGPUs(8, "H100", 80), DPUs: makeDPUs(2, "10.10.2.30", "10.10.2.40"), NVLinkDomain: "nvl-rdu-b", CPUs: 128, RAMGB: 2048},
	{Name: "srv-bos-a-02", Model: "DGX H100", SerialNumber: "DGX-BOS-A02", GPUs: makeGPUs(8, "H100", 80), DPUs: makeDPUs(2, "10.20.1.30", "10.20.1.40"), NVLinkDomain: "nvl-bos-a", CPUs: 128, RAMGB: 2048},
}

var mockNVLinkDomains = []models.NicoNVLinkDomain{
	{Name: "nvl-rdu-a", Servers: []string{"srv-rdu-a-01", "srv-rdu-a-02", "srv-rdu-a-03"}, GPUCount: 24},
	{Name: "nvl-rdu-b", Servers: []string{"srv-rdu-b-01", "srv-rdu-b-02"}, GPUCount: 16},
	{Name: "nvl-bos-a", Servers: []string{"srv-bos-a-02"}, GPUCount: 8},
}

var mockSwitches = []models.NicoSwitch{
	{Name: "sw-rdu-a-spine-01", Model: "Spectrum-4 SN5600", Firmware: "3.11.1000", Role: "spine", Ports: 64},
	{Name: "sw-rdu-a-leaf-01", Model: "Spectrum-4 SN5400", Firmware: "3.11.1000", Role: "leaf", Ports: 64},
	{Name: "sw-rdu-a-leaf-02", Model: "Spectrum-4 SN5400", Firmware: "3.11.1000", Role: "leaf", Ports: 64},
	{Name: "sw-rdu-b-leaf-01", Model: "Spectrum-4 SN5400", Firmware: "3.11.1000", Role: "leaf", Ports: 64},
}

func (c *MockClient) Connect(_ models.NicoConnectRequest) (*models.NicoConnectResponse, error) {
	c.connected = true
	totalGPUs := 0
	totalDPUs := 0
	for _, s := range mockServers {
		totalGPUs += len(s.GPUs)
		totalDPUs += len(s.DPUs)
	}
	return &models.NicoConnectResponse{
		Connected:   true,
		Controller:  "nico.example.com",
		ServerCount: len(mockServers),
		GPUCount:    totalGPUs,
		DPUCount:    totalDPUs,
	}, nil
}

func (c *MockClient) Disconnect() { c.connected = false }

func (c *MockClient) Inventory() (*models.NicoInventory, error) {
	if !c.connected {
		return &models.NicoInventory{}, nil
	}
	return &models.NicoInventory{
		Servers:       mockServers,
		NVLinkDomains: mockNVLinkDomains,
		Switches:      mockSwitches,
	}, nil
}
