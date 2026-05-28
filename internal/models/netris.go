package models

type NetrisSite struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	PublicASN   int    `json:"publicAsn"`
	SiteMesh    string `json:"siteMesh"`
	ACLPolicy   string `json:"aclPolicy"`
	SwitchCount int    `json:"switchCount"`
	ServerCount int    `json:"serverCount"`
}

type NetrisServer struct {
	ID          int               `json:"id"`
	Name        string            `json:"name"`
	SiteID      int               `json:"siteId"`
	SiteName    string            `json:"siteName"`
	Description string            `json:"description,omitempty"`
	MainIP      string            `json:"mainIp,omitempty"`
	MgmtIP      string            `json:"mgmtIp"`
	PortCount   int               `json:"portCount"`
	MACAddress  string            `json:"macAddress,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
}

type NetrisSwitch struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	SiteID    int    `json:"siteId"`
	SiteName  string `json:"siteName"`
	NOS       string `json:"nos"`
	Role      string `json:"role"`
	PortCount int    `json:"portCount"`
}

type NetrisSoftGate struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	SiteID   int    `json:"siteId"`
	SiteName string `json:"siteName"`
	MainIP   string `json:"mainIp"`
	MgmtIP   string `json:"mgmtIp"`
}

type NetrisVPC struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	TenantID int    `json:"tenantId"`
	Tenant   string `json:"tenant"`
}

type NetrisSubnet struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	Prefix  string `json:"prefix"`
	Purpose string `json:"purpose"`
	SiteID  int    `json:"siteId"`
	VPCID   int    `json:"vpcId"`
	Gateway string `json:"gateway,omitempty"`
}

type NetrisInventory struct {
	Servers   []NetrisServer   `json:"servers"`
	Switches  []NetrisSwitch   `json:"switches"`
	SoftGates []NetrisSoftGate `json:"softGates"`
}

type NetrisIPAM struct {
	Subnets []NetrisSubnet `json:"subnets"`
}

type NetrisConnectRequest struct {
	URL      string `json:"url" doc:"Netris controller URL"`
	AuthType string `json:"authType" doc:"Authentication type: token or password" enum:"token,password"`
	Token    string `json:"token,omitempty" doc:"API token (when authType is token)"`
	Username string `json:"username,omitempty" doc:"Username (when authType is password)"`
	Password string `json:"password,omitempty" doc:"Password (when authType is password)"`
}

type NetrisConnectResponse struct {
	Connected  bool   `json:"connected"`
	Controller string `json:"controller"`
	SiteCount  int    `json:"siteCount"`
	ServerCount int   `json:"serverCount"`
	VPCCount   int    `json:"vpcCount"`
}
