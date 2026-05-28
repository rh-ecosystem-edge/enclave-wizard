package models

type NicoGPU struct {
	Index    int    `json:"index"`
	Type     string `json:"type"`
	MemoryGB int    `json:"memoryGb"`
	Health   string `json:"health"`
}

type NicoDPU struct {
	Name      string `json:"name"`
	Model     string `json:"model"`
	Firmware  string `json:"firmware"`
	VFCount   int    `json:"vfCount"`
	MgmtIP    string `json:"mgmtIp"`
	BmcIP     string `json:"bmcIp"`
}

type NicoServer struct {
	Name         string   `json:"name"`
	Model        string   `json:"model"`
	SerialNumber string   `json:"serialNumber"`
	GPUs         []NicoGPU `json:"gpus"`
	DPUs         []NicoDPU `json:"dpus"`
	NVLinkDomain string   `json:"nvlinkDomain,omitempty"`
	CPUs         int      `json:"cpus"`
	RAMGB        int      `json:"ramGb"`
}

type NicoNVLinkDomain struct {
	Name    string   `json:"name"`
	Servers []string `json:"servers"`
	GPUCount int     `json:"gpuCount"`
}

type NicoSwitch struct {
	Name     string `json:"name"`
	Model    string `json:"model"`
	Firmware string `json:"firmware"`
	Role     string `json:"role"`
	Ports    int    `json:"ports"`
}

type NicoInventory struct {
	Servers       []NicoServer       `json:"servers"`
	NVLinkDomains []NicoNVLinkDomain `json:"nvlinkDomains"`
	Switches      []NicoSwitch       `json:"switches"`
}

type NicoConnectRequest struct {
	URL      string `json:"url" doc:"NICo controller URL"`
	Username string `json:"username" doc:"Username"`
	Password string `json:"password" doc:"Password"`
}

type NicoConnectResponse struct {
	Connected   bool   `json:"connected"`
	Controller  string `json:"controller"`
	ServerCount int    `json:"serverCount"`
	GPUCount    int    `json:"gpuCount"`
	DPUCount    int    `json:"dpuCount"`
}
