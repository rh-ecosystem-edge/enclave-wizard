package models

type OSAvailabilityZone struct {
	Name      string `json:"name"`
	Available bool   `json:"available"`
	HostCount int    `json:"hostCount"`
}

type OSBaremetalNode struct {
	UUID             string `json:"uuid"`
	Name             string `json:"name"`
	ProvisionState   string `json:"provisionState"`
	PowerState       string `json:"powerState"`
	Driver           string `json:"driver"`
	BmcAddress       string `json:"bmcAddress"`
	BmcUser          string `json:"bmcUser"`
	BmcPassword      string `json:"bmcPassword"`
	BootMACAddress   string `json:"bootMacAddress"`
	RootDisk         string `json:"rootDisk"`
	CPUs             int    `json:"cpus"`
	RAMGB            int    `json:"ramGb"`
	DiskGB           int    `json:"diskGb"`
	Manufacturer     string `json:"manufacturer"`
	Model            string `json:"model"`
	SerialNumber     string `json:"serialNumber"`
	AvailabilityZone string `json:"availabilityZone"`
}

type OSNetwork struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	NetworkType  string     `json:"networkType"`
	PhysicalNet  string     `json:"physicalNet,omitempty"`
	Shared       bool       `json:"shared"`
	Subnets      []OSSubnet `json:"subnets"`
}

type OSSubnet struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CIDR      string `json:"cidr"`
	Gateway   string `json:"gateway"`
	DNS       string `json:"dns,omitempty"`
	IPVersion int    `json:"ipVersion"`
}

type OSInventory struct {
	AvailabilityZones []OSAvailabilityZone `json:"availabilityZones"`
	BaremetalNodes     []OSBaremetalNode    `json:"baremetalNodes"`
	Networks           []OSNetwork          `json:"networks"`
}

type OSConnectRequest struct {
	AuthURL  string `json:"authUrl" doc:"Keystone auth URL (v3)"`
	Username string `json:"username" doc:"Username"`
	Password string `json:"password" doc:"Password"`
	Project  string `json:"project" doc:"Project/tenant name"`
	Domain   string `json:"domain" doc:"Domain name"`
}

type OSConnectResponse struct {
	Connected     bool   `json:"connected"`
	Endpoint      string `json:"endpoint"`
	Project       string `json:"project"`
	AZCount       int    `json:"azCount"`
	NodeCount     int    `json:"nodeCount"`
	NetworkCount  int    `json:"networkCount"`
}
