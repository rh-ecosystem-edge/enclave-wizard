package models

type DiscoveredNode struct {
	ID             string            `json:"id"`
	Name           string            `json:"name"`
	BmcIP          string            `json:"bmcIp,omitempty"`
	BmcUser        string            `json:"bmcUser,omitempty"`
	BmcPassword    string            `json:"bmcPassword,omitempty"`
	MACAddress     string            `json:"macAddress,omitempty"`
	IPAddress      string            `json:"ipAddress,omitempty"`
	RootDisk       string            `json:"rootDisk,omitempty"`
	SiteName       string            `json:"siteName,omitempty"`
	SiteID         int               `json:"siteId,omitempty"`
	Description    string            `json:"description,omitempty"`
	CPUs           int               `json:"cpus,omitempty"`
	RAMGB          int               `json:"ramGb,omitempty"`
	DiskGB         int               `json:"diskGb,omitempty"`
	GPUCount       int               `json:"gpuCount,omitempty"`
	GPUType        string            `json:"gpuType,omitempty"`
	NVLinkDomain   string            `json:"nvlinkDomain,omitempty"`
	RackPosition   string            `json:"rackPosition,omitempty"`
	PortCount      int               `json:"portCount,omitempty"`
	Labels         map[string]string `json:"labels,omitempty"`
	Sources        []string          `json:"sources"`
}

type DiscoveredSite struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	ASN         int    `json:"asn,omitempty"`
	Mesh        string `json:"mesh,omitempty"`
	NodeCount   int    `json:"nodeCount"`
	SwitchCount int    `json:"switchCount,omitempty"`
	Sources     []string `json:"sources"`
}

type DiscoveredNetwork struct {
	ID      int      `json:"id"`
	Name    string   `json:"name"`
	Prefix  string   `json:"prefix"`
	Gateway string   `json:"gateway,omitempty"`
	Purpose string   `json:"purpose,omitempty"`
	SiteID  int      `json:"siteId,omitempty"`
	VPCName string   `json:"vpcName,omitempty"`
	Sources []string `json:"sources"`
}

type DiscoveredInventory struct {
	Sites    []DiscoveredSite    `json:"sites"`
	Nodes    []DiscoveredNode    `json:"nodes"`
	Networks []DiscoveredNetwork `json:"networks"`
}
