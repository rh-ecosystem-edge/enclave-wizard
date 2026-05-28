package api

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/netbox"
)

type NetboxHandler struct {
	client netbox.Client
}

func NewNetboxHandler(client netbox.Client) *NetboxHandler {
	return &NetboxHandler{client: client}
}

type NetboxConnectInput struct {
	Body models.NetboxConnectRequest
}

type NetboxConnectOutput struct {
	Body models.NetboxConnectResponse
}

type NetboxInventoryOutput struct {
	Body models.NetboxInventory
}

func (h *NetboxHandler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "netbox-connect",
		Method:      http.MethodPost,
		Path:        "/api/v1/netbox/connect",
		Summary:     "Connect to NetBox",
		Tags:        []string{"NetBox"},
	}, h.connect)

	huma.Register(api, huma.Operation{
		OperationID: "netbox-inventory",
		Method:      http.MethodGet,
		Path:        "/api/v1/netbox/inventory",
		Summary:     "List NetBox inventory",
		Description: "Returns sites, devices, racks, prefixes, and VRFs.",
		Tags:        []string{"NetBox"},
	}, h.inventory)
}

func (h *NetboxHandler) connect(_ context.Context, input *NetboxConnectInput) (*NetboxConnectOutput, error) {
	resp, err := h.client.Connect(input.Body)
	if err != nil {
		return nil, huma.Error502BadGateway("failed to connect to NetBox", err)
	}
	return &NetboxConnectOutput{Body: *resp}, nil
}

func (h *NetboxHandler) inventory(_ context.Context, _ *struct{}) (*NetboxInventoryOutput, error) {
	inv, err := h.client.Inventory()
	if err != nil {
		return nil, huma.Error502BadGateway("failed to list NetBox inventory", err)
	}
	return &NetboxInventoryOutput{Body: *inv}, nil
}
