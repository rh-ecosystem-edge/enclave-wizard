package api

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/openstack"
)

type OpenStackHandler struct {
	client openstack.Client
}

func NewOpenStackHandler(client openstack.Client) *OpenStackHandler {
	return &OpenStackHandler{client: client}
}

type OSConnectInput struct {
	Body models.OSConnectRequest
}

type OSConnectOutput struct {
	Body models.OSConnectResponse
}

type OSInventoryOutput struct {
	Body models.OSInventory
}

func (h *OpenStackHandler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "openstack-connect",
		Method:      http.MethodPost,
		Path:        "/api/v1/openstack/connect",
		Summary:     "Connect to OpenStack",
		Tags:        []string{"OpenStack"},
	}, h.connect)

	huma.Register(api, huma.Operation{
		OperationID: "openstack-inventory",
		Method:      http.MethodGet,
		Path:        "/api/v1/openstack/inventory",
		Summary:     "List OpenStack inventory",
		Description: "Returns availability zones, bare metal nodes (Ironic), and networks (Neutron).",
		Tags:        []string{"OpenStack"},
	}, h.inventory)
}

func (h *OpenStackHandler) connect(_ context.Context, input *OSConnectInput) (*OSConnectOutput, error) {
	resp, err := h.client.Connect(input.Body)
	if err != nil {
		return nil, huma.Error502BadGateway("failed to connect to OpenStack", err)
	}
	return &OSConnectOutput{Body: *resp}, nil
}

func (h *OpenStackHandler) inventory(_ context.Context, _ *struct{}) (*OSInventoryOutput, error) {
	inv, err := h.client.Inventory()
	if err != nil {
		return nil, huma.Error502BadGateway("failed to list OpenStack inventory", err)
	}
	return &OSInventoryOutput{Body: *inv}, nil
}
