package netris

import "github.com/rh-ecosystem-edge/enclave-wizard/internal/models"

type Client interface {
	Connect(req models.NetrisConnectRequest) (*models.NetrisConnectResponse, error)
	Sites() ([]models.NetrisSite, error)
	Inventory(siteID *int) (*models.NetrisInventory, error)
	VPCs() ([]models.NetrisVPC, error)
	IPAM(siteID *int) (*models.NetrisIPAM, error)
}
