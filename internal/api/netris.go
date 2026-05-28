package api

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/discovery"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/netris"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/nico"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/openstack"
)

type NetrisHandler struct {
	client     netris.Client
	nicoClient nico.Client
	osClient   openstack.Client
}

func NewNetrisHandler(client netris.Client) *NetrisHandler {
	return &NetrisHandler{client: client}
}

func (h *NetrisHandler) SetNicoClient(c nico.Client) {
	h.nicoClient = c
}

func (h *NetrisHandler) SetOpenStackClient(c openstack.Client) {
	h.osClient = c
}

type NetrisConnectInput struct {
	Body models.NetrisConnectRequest
}

type NetrisConnectOutput struct {
	Body models.NetrisConnectResponse
}

type NetrisSitesOutput struct {
	Body struct {
		Sites []models.NetrisSite `json:"sites"`
	}
}

type NetrisInventoryInput struct {
	SiteID int `query:"siteId" doc:"Filter by site ID (0 = all)" default:"0"`
}

type NetrisInventoryOutput struct {
	Body models.NetrisInventory
}

type NetrisVPCsOutput struct {
	Body struct {
		VPCs []models.NetrisVPC `json:"vpcs"`
	}
}

type NetrisIPAMInput struct {
	SiteID int `query:"siteId" doc:"Filter by site ID (0 = all)" default:"0"`
}

type NetrisIPAMOutput struct {
	Body models.NetrisIPAM
}

type DiscoveryOutput struct {
	Body models.DiscoveredInventory
}

func (h *NetrisHandler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "netris-connect",
		Method:      http.MethodPost,
		Path:        "/api/v1/netris/connect",
		Summary:     "Connect to Netris controller",
		Description: "Validate Netris credentials and return connection status with inventory summary.",
		Tags:        []string{"Netris"},
	}, h.connect)

	huma.Register(api, huma.Operation{
		OperationID: "netris-sites",
		Method:      http.MethodGet,
		Path:        "/api/v1/netris/sites",
		Summary:     "List Netris sites",
		Tags:        []string{"Netris"},
	}, h.sites)

	huma.Register(api, huma.Operation{
		OperationID: "netris-inventory",
		Method:      http.MethodGet,
		Path:        "/api/v1/netris/inventory",
		Summary:     "List Netris inventory",
		Description: "Returns servers, switches, and softgates. Optionally filtered by site.",
		Tags:        []string{"Netris"},
	}, h.inventory)

	huma.Register(api, huma.Operation{
		OperationID: "netris-vpcs",
		Method:      http.MethodGet,
		Path:        "/api/v1/netris/vpcs",
		Summary:     "List Netris VPCs",
		Tags:        []string{"Netris"},
	}, h.vpcs)

	huma.Register(api, huma.Operation{
		OperationID: "netris-ipam",
		Method:      http.MethodGet,
		Path:        "/api/v1/netris/ipam",
		Summary:     "List Netris IPAM subnets",
		Description: "Returns subnets with purpose and gateway info. Optionally filtered by site.",
		Tags:        []string{"Netris"},
	}, h.ipam)

	huma.Register(api, huma.Operation{
		OperationID: "discovery-inventory",
		Method:      http.MethodGet,
		Path:        "/api/v1/discovery/inventory",
		Summary:     "Get merged discovery inventory",
		Description: "Returns unified inventory merged from all connected providers (sites, nodes, networks).",
		Tags:        []string{"Discovery"},
	}, h.mergedInventory)
}

func (h *NetrisHandler) connect(_ context.Context, input *NetrisConnectInput) (*NetrisConnectOutput, error) {
	resp, err := h.client.Connect(input.Body)
	if err != nil {
		return nil, huma.Error502BadGateway("failed to connect to Netris controller", err)
	}
	return &NetrisConnectOutput{Body: *resp}, nil
}

func (h *NetrisHandler) sites(_ context.Context, _ *struct{}) (*NetrisSitesOutput, error) {
	s, err := h.client.Sites()
	if err != nil {
		return nil, huma.Error502BadGateway("failed to list sites", err)
	}
	out := &NetrisSitesOutput{}
	out.Body.Sites = s
	return out, nil
}

func (h *NetrisHandler) inventory(_ context.Context, input *NetrisInventoryInput) (*NetrisInventoryOutput, error) {
	var siteID *int
	if input.SiteID > 0 {
		siteID = &input.SiteID
	}
	inv, err := h.client.Inventory(siteID)
	if err != nil {
		return nil, huma.Error502BadGateway("failed to list inventory", err)
	}
	return &NetrisInventoryOutput{Body: *inv}, nil
}

func (h *NetrisHandler) vpcs(_ context.Context, _ *struct{}) (*NetrisVPCsOutput, error) {
	v, err := h.client.VPCs()
	if err != nil {
		return nil, huma.Error502BadGateway("failed to list VPCs", err)
	}
	out := &NetrisVPCsOutput{}
	out.Body.VPCs = v
	return out, nil
}

func (h *NetrisHandler) ipam(_ context.Context, input *NetrisIPAMInput) (*NetrisIPAMOutput, error) {
	var siteID *int
	if input.SiteID > 0 {
		siteID = &input.SiteID
	}
	ipam, err := h.client.IPAM(siteID)
	if err != nil {
		return nil, huma.Error502BadGateway("failed to list IPAM", err)
	}
	return &NetrisIPAMOutput{Body: *ipam}, nil
}

func (h *NetrisHandler) mergedInventory(_ context.Context, _ *struct{}) (*DiscoveryOutput, error) {
	sites, err := h.client.Sites()
	if err != nil {
		return nil, huma.Error502BadGateway("failed to list sites", err)
	}
	inv, err := h.client.Inventory(nil)
	if err != nil {
		return nil, huma.Error502BadGateway("failed to list inventory", err)
	}
	ipam, err := h.client.IPAM(nil)
	if err != nil {
		return nil, huma.Error502BadGateway("failed to list IPAM", err)
	}
	merged := discovery.MergeFromNetris(sites, inv, ipam)

	if h.nicoClient != nil {
		nicoInv, err := h.nicoClient.Inventory()
		if err == nil {
			discovery.MergeNicoInto(merged, nicoInv)
		}
	}

	if h.osClient != nil {
		osInv, err := h.osClient.Inventory()
		if err == nil {
			discovery.MergeOpenStackInto(merged, osInv)
		}
	}

	return &DiscoveryOutput{Body: *merged}, nil
}
