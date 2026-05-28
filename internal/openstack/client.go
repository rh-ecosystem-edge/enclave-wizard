package openstack

import "github.com/rh-ecosystem-edge/enclave-wizard/internal/models"

type Client interface {
	Connect(req models.OSConnectRequest) (*models.OSConnectResponse, error)
	Inventory() (*models.OSInventory, error)
}
