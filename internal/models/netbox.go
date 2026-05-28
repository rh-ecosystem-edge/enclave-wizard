package models

type NetboxSite struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Slug     string `json:"slug"`
	Region   string `json:"region,omitempty"`
	Facility string `json:"facility,omitempty"`
	ASN      int    `json:"asn,omitempty"`
	Status   string `json:"status"`
}

type NetboxDevice struct {
	ID           int               `json:"id"`
	Name         string            `json:"name"`
	DeviceType   string            `json:"deviceType"`
	Manufacturer string            `json:"manufacturer"`
	Role         string            `json:"role"`
	Site         string            `json:"site"`
	Rack         string            `json:"rack,omitempty"`
	Position     float64           `json:"position,omitempty"`
	SerialNumber string            `json:"serialNumber,omitempty"`
	Status       string            `json:"status"`
	PrimaryIP    string            `json:"primaryIp,omitempty"`
	Tags         []string          `json:"tags,omitempty"`
}

type NetboxPrefix struct {
	ID     int    `json:"id"`
	Prefix string `json:"prefix"`
	Status string `json:"status"`
	Site   string `json:"site,omitempty"`
	VRF    string `json:"vrf,omitempty"`
	Role   string `json:"role,omitempty"`
	Tenant string `json:"tenant,omitempty"`
	IsPool bool   `json:"isPool"`
}

type NetboxVRF struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	RD   string `json:"rd"`
}

type NetboxRack struct {
	ID       int     `json:"id"`
	Name     string  `json:"name"`
	Site     string  `json:"site"`
	UHeight  int     `json:"uHeight"`
	Devices  int     `json:"devices"`
	UtilPct  float64 `json:"utilizationPercent"`
}

type NetboxInventory struct {
	Sites    []NetboxSite    `json:"sites"`
	Devices  []NetboxDevice  `json:"devices"`
	Racks    []NetboxRack    `json:"racks"`
	Prefixes []NetboxPrefix  `json:"prefixes"`
	VRFs     []NetboxVRF     `json:"vrfs"`
}

type NetboxConnectRequest struct {
	URL   string `json:"url" doc:"NetBox URL"`
	Token string `json:"token" doc:"API token"`
}

type NetboxConnectResponse struct {
	Connected   bool   `json:"connected"`
	Endpoint    string `json:"endpoint"`
	SiteCount   int    `json:"siteCount"`
	DeviceCount int    `json:"deviceCount"`
	PrefixCount int    `json:"prefixCount"`
}
