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

func MergeOpenStackInto(inv *models.DiscoveredInventory, osInv *models.OSInventory) {
	if osInv == nil {
		return
	}

	for _, az := range osInv.AvailabilityZones {
		nodeCount := 0
		for _, n := range osInv.BaremetalNodes {
			if n.AvailabilityZone == az.Name {
				nodeCount++
			}
		}
		inv.Sites = append(inv.Sites, models.DiscoveredSite{
			ID:        len(inv.Sites) + 1,
			Name:      az.Name,
			NodeCount: nodeCount,
			Sources:   []string{"openstack"},
		})
	}

	serverIndex := make(map[string]int)
	for i, n := range inv.Nodes {
		serverIndex[n.Name] = i
	}

	for _, node := range osInv.BaremetalNodes {
		bmcIP := node.BmcAddress
		if idx := len("redfish://"); len(bmcIP) > idx {
			if slashIdx := indexOf(bmcIP[idx:], '/'); slashIdx > 0 {
				bmcIP = bmcIP[idx : idx+slashIdx]
			}
		}

		if idx, ok := serverIndex[node.Name]; ok {
			n := &inv.Nodes[idx]
			if n.BmcIP == "" {
				n.BmcIP = bmcIP
			}
			if n.BmcUser == "" {
				n.BmcUser = node.BmcUser
			}
			if n.BmcPassword == "" {
				n.BmcPassword = node.BmcPassword
			}
			if n.MACAddress == "" {
				n.MACAddress = node.BootMACAddress
			}
			if n.RootDisk == "" || n.RootDisk == "/dev/sda" {
				n.RootDisk = node.RootDisk
			}
			if n.CPUs == 0 {
				n.CPUs = node.CPUs
			}
			if n.RAMGB == 0 {
				n.RAMGB = node.RAMGB
			}
			if n.Description == "" {
				n.Description = node.Model
			}
			if !containsSource(n.Sources, "openstack") {
				n.Sources = append(n.Sources, "openstack")
			}
			continue
		}

		inv.Nodes = append(inv.Nodes, models.DiscoveredNode{
			ID:          fmt.Sprintf("os-%s", node.UUID),
			Name:        node.Name,
			BmcIP:       bmcIP,
			BmcUser:     node.BmcUser,
			BmcPassword: node.BmcPassword,
			MACAddress:  node.BootMACAddress,
			RootDisk:    node.RootDisk,
			Description: node.Model,
			CPUs:        node.CPUs,
			RAMGB:       node.RAMGB,
			Sources:     []string{"openstack"},
		})
	}

	for _, net := range osInv.Networks {
		for _, sub := range net.Subnets {
			inv.Networks = append(inv.Networks, models.DiscoveredNetwork{
				ID:      len(inv.Networks) + 1,
				Name:    sub.Name,
				Prefix:  sub.CIDR,
				Gateway: sub.Gateway,
				Purpose: net.NetworkType,
				Sources: []string{"openstack"},
			})
		}
	}
}

func MergeNetboxInto(inv *models.DiscoveredInventory, nbInv *models.NetboxInventory) {
	if nbInv == nil {
		return
	}

	for _, site := range nbInv.Sites {
		deviceCount := 0
		for _, d := range nbInv.Devices {
			if d.Site == site.Name {
				deviceCount++
			}
		}
		inv.Sites = append(inv.Sites, models.DiscoveredSite{
			ID:        len(inv.Sites) + 1,
			Name:      site.Name,
			ASN:       site.ASN,
			NodeCount: deviceCount,
			Sources:   []string{"netbox"},
		})
	}

	serverIndex := make(map[string]int)
	for i, n := range inv.Nodes {
		serverIndex[n.Name] = i
	}

	for _, dev := range nbInv.Devices {
		rackPos := ""
		if dev.Rack != "" && dev.Position > 0 {
			rackPos = fmt.Sprintf("%s U%.0f", dev.Rack, dev.Position)
		}

		if idx, ok := serverIndex[dev.Name]; ok {
			n := &inv.Nodes[idx]
			if n.RackPosition == "" {
				n.RackPosition = rackPos
			}
			if n.Description == "" {
				n.Description = fmt.Sprintf("%s %s", dev.Manufacturer, dev.DeviceType)
			}
			if !containsSource(n.Sources, "netbox") {
				n.Sources = append(n.Sources, "netbox")
			}
			continue
		}

		inv.Nodes = append(inv.Nodes, models.DiscoveredNode{
			ID:           fmt.Sprintf("nb-%d", dev.ID),
			Name:         dev.Name,
			Description:  fmt.Sprintf("%s %s", dev.Manufacturer, dev.DeviceType),
			IPAddress:    dev.PrimaryIP,
			RackPosition: rackPos,
			Sources:      []string{"netbox"},
		})
	}

	for _, pfx := range nbInv.Prefixes {
		if pfx.Status == "container" {
			continue
		}
		inv.Networks = append(inv.Networks, models.DiscoveredNetwork{
			ID:      len(inv.Networks) + 1,
			Name:    pfx.Prefix,
			Prefix:  pfx.Prefix,
			Purpose: pfx.Role,
			VPCName: pfx.VRF,
			Sources: []string{"netbox"},
		})
	}
}

func indexOf(s string, c byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == c {
			return i
		}
	}
	return -1
}

func containsSource(sources []string, s string) bool {
	for _, src := range sources {
		if src == s {
			return true
		}
	}
	return false
}
