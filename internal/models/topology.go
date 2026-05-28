package models

type AvailabilityZone struct {
	Name           string `json:"name" yaml:"name" doc:"Unique AZ identifier" minLength:"1"`
	Gateway        string `json:"gateway" yaml:"gateway" doc:"Per-AZ gateway IP" pattern:"^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"`
	MachineNetwork string `json:"machineNetwork" yaml:"machineNetwork" doc:"Network CIDR for this AZ" pattern:"^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/(3[0-2]|[12]?[0-9])$"`
	DNS            string `json:"dns,omitempty" yaml:"dns,omitempty" doc:"Per-AZ DNS server (falls back to global defaultDNS if empty)"`
}

type TopologyConfig struct {
	AvailabilityZones []AvailabilityZone `json:"availability_zones" yaml:"availability_zones" doc:"Availability zone definitions"`
}
