package netbox

import "github.com/rh-ecosystem-edge/enclave-wizard/internal/models"

type Client interface {
	Connect(req models.NetboxConnectRequest) (*models.NetboxConnectResponse, error)
	Inventory() (*models.NetboxInventory, error)
}
