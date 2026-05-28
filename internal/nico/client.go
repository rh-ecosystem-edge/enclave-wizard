package nico

import "github.com/rh-ecosystem-edge/enclave-wizard/internal/models"

type Client interface {
	Connect(req models.NicoConnectRequest) (*models.NicoConnectResponse, error)
	Inventory() (*models.NicoInventory, error)
}
