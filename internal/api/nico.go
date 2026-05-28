package api

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/nico"
)

type NicoHandler struct {
	client nico.Client
}

func NewNicoHandler(client nico.Client) *NicoHandler {
	return &NicoHandler{client: client}
}

type NicoConnectInput struct {
	Body models.NicoConnectRequest
}

type NicoConnectOutput struct {
	Body models.NicoConnectResponse
}

type NicoInventoryOutput struct {
	Body models.NicoInventory
}

func (h *NicoHandler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "nico-connect",
		Method:      http.MethodPost,
		Path:        "/api/v1/nico/connect",
		Summary:     "Connect to NVIDIA NICo controller",
		Tags:        []string{"NICo"},
	}, h.connect)

	huma.Register(api, huma.Operation{
		OperationID: "nico-inventory",
		Method:      http.MethodGet,
		Path:        "/api/v1/nico/inventory",
		Summary:     "List NICo inventory",
		Description: "Returns GPU servers, NVLink domains, DPUs, and Spectrum switches.",
		Tags:        []string{"NICo"},
	}, h.inventory)
}

func (h *NicoHandler) connect(_ context.Context, input *NicoConnectInput) (*NicoConnectOutput, error) {
	resp, err := h.client.Connect(input.Body)
	if err != nil {
		return nil, huma.Error502BadGateway("failed to connect to NICo controller", err)
	}
	return &NicoConnectOutput{Body: *resp}, nil
}

func (h *NicoHandler) inventory(_ context.Context, _ *struct{}) (*NicoInventoryOutput, error) {
	inv, err := h.client.Inventory()
	if err != nil {
		return nil, huma.Error502BadGateway("failed to list NICo inventory", err)
	}
	return &NicoInventoryOutput{Body: *inv}, nil
}
