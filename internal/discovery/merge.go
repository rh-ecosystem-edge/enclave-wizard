package discovery

import (
	"fmt"

	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
)

func MergeFromNetris(
	sites []models.NetrisSite,
	inv *models.NetrisInventory,
	ipam *models.NetrisIPAM,
) *models.DiscoveredInventory {
	result := &models.DiscoveredInventory{}

	for _, s := range sites {
		result.Sites = append(result.Sites, models.DiscoveredSite{
			ID:          s.ID,
			Name:        s.Name,
			ASN:         s.PublicASN,
			Mesh:        s.SiteMesh,
			NodeCount:   s.ServerCount,
			SwitchCount: s.SwitchCount,
			Sources:     []string{"netris"},
		})
	}

	if inv != nil {
		for _, srv := range inv.Servers {
			node := models.DiscoveredNode{
				ID:          fmt.Sprintf("netris-%d", srv.ID),
				Name:        srv.Name,
				BmcIP:       srv.MgmtIP,
				MACAddress:  srv.MACAddress,
				RootDisk:    "/dev/sda",
				SiteName:    srv.SiteName,
				SiteID:      srv.SiteID,
				Description: srv.Description,
				PortCount:   srv.PortCount,
				Labels:      srv.Labels,
				Sources:     []string{"netris"},
			}

			if gpu, ok := srv.Labels["gpu"]; ok {
				node.GPUType = gpu
				node.GPUCount = 8
			}

			result.Nodes = append(result.Nodes, node)
		}
	}

	if ipam != nil {
		for _, sub := range ipam.Subnets {
			result.Networks = append(result.Networks, models.DiscoveredNetwork{
				ID:      sub.ID,
				Name:    sub.Name,
				Prefix:  sub.Prefix,
				Gateway: sub.Gateway,
				Purpose: sub.Purpose,
				SiteID:  sub.SiteID,
				Sources: []string{"netris"},
			})
		}
	}

	return result
}
