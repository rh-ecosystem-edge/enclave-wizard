package models

type HostEntry struct {
	Name            string  `json:"name" yaml:"name" doc:"Node name label" minLength:"1"`
	Redfish         string  `json:"redfish" yaml:"redfish" doc:"Redfish/IPMI management IP" pattern:"^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(:\\d+)?$"`
	RedfishUser     string  `json:"redfishUser" yaml:"redfishUser" doc:"Redfish username" minLength:"1"`
	RedfishPassword string  `json:"redfishPassword" yaml:"redfishPassword" doc:"Redfish password" minLength:"1"`
	RootDisk        string  `json:"rootDisk" yaml:"rootDisk" doc:"Root disk path for OS installation" minLength:"1"`
	BMCSystemID     *string `json:"bmcSystemId,omitempty" yaml:"bmcSystemId,omitempty" doc:"Redfish system ID path component (default: 1)"`

	// Used if NetworkConfig is not provided along with default DNS/Gateway/Prefix
	MACAddress string `json:"macAddress" yaml:"macAddress" doc:"MAC address (xx:xx:xx:xx:xx:xx)" pattern:"^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$"`
	IPAddress  string `json:"ipAddress" yaml:"ipAddress" doc:"Node IPv4 address within machineNetwork" pattern:"^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"`

	// Full NMStateConfig format (config and interfaces respectively)
	NetworkConfig any `json:"networkConfig,omitempty" yaml:"networkConfig,omitempty" doc:"NMState network configuration for multi-NIC/VLAN"`
	MapInterfaces any `json:"mapInterfaces,omitempty" yaml:"mapInterfaces,omitempty" doc:"Interface mapping for complex topologies"`
	Zone          string `json:"zone,omitempty" yaml:"zone,omitempty" doc:"Availability zone assignment"`
}
