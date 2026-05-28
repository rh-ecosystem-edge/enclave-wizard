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

func MergeNicoInto(inv *models.DiscoveredInventory, nicoInv *models.NicoInventory) {
	if nicoInv == nil {
		return
	}

	serverIndex := make(map[string]int)
	for i, n := range inv.Nodes {
		serverIndex[n.Name] = i
	}

	for _, srv := range nicoInv.Servers {
		if idx, ok := serverIndex[srv.Name]; ok {
			node := &inv.Nodes[idx]
			node.GPUCount = len(srv.GPUs)
			if len(srv.GPUs) > 0 {
				node.GPUType = srv.GPUs[0].Type
			}
			node.NVLinkDomain = srv.NVLinkDomain
			node.CPUs = srv.CPUs
			node.RAMGB = srv.RAMGB
			if !containsSource(node.Sources, "nico") {
				node.Sources = append(node.Sources, "nico")
			}
			continue
		}

		node := models.DiscoveredNode{
			ID:           fmt.Sprintf("nico-%s", srv.Name),
			Name:         srv.Name,
			Description:  srv.Model,
			NVLinkDomain: srv.NVLinkDomain,
			CPUs:         srv.CPUs,
			RAMGB:        srv.RAMGB,
			Sources:      []string{"nico"},
		}
		if len(srv.GPUs) > 0 {
			node.GPUCount = len(srv.GPUs)
			node.GPUType = srv.GPUs[0].Type
		}
		inv.Nodes = append(inv.Nodes, node)
	}

	for _, domain := range nicoInv.NVLinkDomains {
		inv.NVLinkDomains = append(inv.NVLinkDomains, models.DiscoveredNVLinkDomain{
			Name:     domain.Name,
			Servers:  domain.Servers,
			GPUCount: domain.GPUCount,
		})
	}
}

func containsSource(sources []string, s string) bool {
	for _, src := range sources {
		if src == s {
			return true
		}
	}
	return false
}
