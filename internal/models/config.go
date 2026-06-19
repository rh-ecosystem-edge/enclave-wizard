package models

// Landing zone
type LandingZoneConfig struct {
	LZBMCIP       string  `json:"lzBmcIP" yaml:"lzBmcIP" doc:"Landing zone BMC IP for boot ISO serving" pattern:"^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"`
	LZBMCHostname *string `json:"lzBmcHostname,omitempty" yaml:"lzBmcHostname,omitempty" doc:"DNS hostname for landing zone BMC interface"`
	WorkingDir    string  `json:"workingDir" yaml:"workingDir" doc:"Absolute path to root working directory" minLength:"1"`
	Disconnected  *bool   `json:"disconnected,omitempty" yaml:"disconnected,omitempty" doc:"Air-gapped deployment mode (default: true)"`
}

// Management Cluster Install Information
type ClusterConfig struct {
	BaseDomain        string      `json:"baseDomain" yaml:"baseDomain" doc:"Base DNS domain for the cluster" minLength:"1"`
	ClusterName       string      `json:"clusterName" yaml:"clusterName" doc:"OpenShift cluster name" minLength:"1"`
	MachineNetwork    string      `json:"machineNetwork" yaml:"machineNetwork" doc:"Network CIDR for cluster nodes" pattern:"^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/(3[0-2]|[12]?[0-9])$"`
	APIVIP            string      `json:"apiVIP" yaml:"apiVIP" doc:"Virtual IP for Kubernetes API server" pattern:"^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"`
	IngressVIP        string      `json:"ingressVIP" yaml:"ingressVIP" doc:"Virtual IP for ingress wildcard" pattern:"^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"`
	RendezvousIP      string      `json:"rendezvousIP" yaml:"rendezvousIP" doc:"IP of first control-plane node" pattern:"^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"`
	PullSecret        any         `json:"pullSecret" yaml:"pullSecret" doc:"OpenShift pull secret object"`
	SSHPubKey        string      `json:"sshPubKey,omitempty" yaml:"sshPubKey" doc:"SSH public key content (e.g. ssh-rsa AAAA...)" minLength:"1"`
	AgentHosts        []HostEntry `json:"agent_hosts" yaml:"agent_hosts" doc:"Control plane nodes (exactly 3)" minItems:"3" maxItems:"3"`
	DiskEncryption    *bool       `json:"diskEncryption,omitempty" yaml:"diskEncryption,omitempty" doc:"Enable TPM v2 disk encryption"`
	DefaultNTPServers []string    `json:"defaultNtpServers,omitempty" yaml:"defaultNtpServers,omitempty" doc:"Additional NTP server addresses"`
	MasterMaxPods     *int        `json:"masterMaxPods,omitempty" yaml:"masterMaxPods,omitempty" doc:"Maximum pods per node (default: 500)" minimum:"1"`
}

// Host Network
type NetworkConfig struct {
	DefaultDNS     string `json:"defaultDNS" yaml:"defaultDNS" doc:"DNS server IP for cluster nodes" pattern:"^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"`
	DefaultGateway string `json:"defaultGateway" yaml:"defaultGateway" doc:"Default gateway IP for cluster nodes" pattern:"^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"`
	DefaultPrefix  int    `json:"defaultPrefix" yaml:"defaultPrefix" doc:"Subnet prefix length" minimum:"1" maximum:"32"`
}

// Quay
type QuayConfig struct {
	QuayUser                    string                       `json:"quayUser" yaml:"quayUser" doc:"Admin username for Quay registry" minLength:"1"`
	QuayPassword                string                       `json:"quayPassword" yaml:"quayPassword" doc:"Admin password for Quay registry" minLength:"1"`
	QuayBackend                 string                       `json:"quayBackend" yaml:"quayBackend" doc:"Quay image storage backend" enum:"RadosGWStorage,LocalStorage"`
	QuayBackendRGWConfiguration *QuayBackendRGWConfiguration `json:"quayBackendRGWConfiguration,omitempty" yaml:"quayBackendRGWConfiguration,omitempty" doc:"RadosGW/S3 backend config (required when quayBackend is RadosGWStorage)"`
	OCMirrorLogLevel            *string                      `json:"ocMirrorLogLevel,omitempty" yaml:"ocMirrorLogLevel,omitempty" doc:"oc-mirror log level" enum:"trace,debug,info,error"`
}

// Storage

type LVMSDeviceSelector struct {
	OptionalPaths []string `json:"optionalPaths,omitempty" yaml:"optionalPaths,omitempty" doc:"Disk device paths for LVM volume group"`
}

type LVMSStorageConfig struct {
	DeviceSelector LVMSDeviceSelector `json:"deviceSelector" yaml:"deviceSelector" doc:"LVMS device selector"`
}

type StorageConfig struct {
	StoragePlugin     string             `json:"storage_plugin" yaml:"storage_plugin" doc:"Storage plugin" enum:"lvms,odf,vast-csi"`
	ODFExternalConfig *string            `json:"odfExternalConfig,omitempty" yaml:"odfExternalConfig,omitempty" doc:"ODF external Ceph cluster config JSON (required when storage_plugin is odf)"`
	LVMSConfig          *LVMSStorageConfig `json:"lvmsConfig,omitempty" yaml:"lvmsConfig,omitempty" doc:"LVMS device selector configuration"`
	VASTEndpoint        *string            `json:"vastEndpoint,omitempty" yaml:"vastEndpoint,omitempty" doc:"VAST management endpoint URL (required when storage_plugin is vast-csi)"`
	VASTAdminUsername   *string            `json:"vastAdminUsername,omitempty" yaml:"vastAdminUsername,omitempty" doc:"VAST management API username"`
	VASTAdminPassword   *string            `json:"vastAdminPassword,omitempty" yaml:"vastAdminPassword,omitempty" doc:"VAST management API password"`
	VASTVipPool         *VASTVipPool       `json:"vastVipPool,omitempty" yaml:"vastVipPool,omitempty" doc:"VIP pool configuration for CSI traffic (required when storage_plugin is vast-csi)"`
}

// Plugins
type PluginsConfig struct {
	EnabledPlugins     []string            `json:"enabled_plugins,omitempty" yaml:"enabled_plugins,omitempty" doc:"Plugins to deploy"`
	OsacProfile        *string             `json:"osacProfile,omitempty" yaml:"osacProfile,omitempty" doc:"OSAC deployment profile" enum:"development,caas,vmaas,bmaas"`
	OsacAapLicenseFile *string             `json:"osacAapLicenseFile,omitempty" yaml:"osacAapLicenseFile,omitempty" doc:"Path to AAP license manifest.zip on the landing zone"`
	OsacBYODatabase    *bool               `json:"osacBYODatabase,omitempty" yaml:"osacBYODatabase,omitempty" doc:"Use external PostgreSQL instead of built-in"`
	OsacDatabaseUrl    *string             `json:"osacDatabaseUrl,omitempty" yaml:"osacDatabaseUrl,omitempty" doc:"PostgreSQL connection URL when using BYO database"`
	RhbkInstances      *int                `json:"rhbk_instances,omitempty" yaml:"rhbk_instances,omitempty" doc:"Number of Keycloak replicas" minimum:"1"`
	RhbkDeployDatabase *bool               `json:"rhbk_deploy_database,omitempty" yaml:"rhbk_deploy_database,omitempty" doc:"Deploy PostgreSQL alongside Keycloak"`
	RhbkDbSize         *string             `json:"rhbk_db_size,omitempty" yaml:"rhbk_db_size,omitempty" doc:"PVC size for Keycloak PostgreSQL"`
	LVMSConfig         *LVMSConfig         `json:"lvmsDefaults,omitempty" yaml:"lvmsDefaults,omitempty" doc:"LVMS deployment configuration"`
	ODFConfig          *ODFConfig          `json:"odfDefaults,omitempty" yaml:"odfDefaults,omitempty" doc:"ODF deployment configuration"`
	VASTConfig         *VASTConfig         `json:"vastDefaults,omitempty" yaml:"vastDefaults,omitempty" doc:"VAST CSI deployment defaults"`
	AAPConfig          *AAPConfig          `json:"aapDefaults,omitempty" yaml:"aapDefaults,omitempty" doc:"AAP deployment configuration"`
	TrustManagerConfig *TrustManagerConfig `json:"trustManagerDefaults,omitempty" yaml:"trustManagerDefaults,omitempty" doc:"Trust-manager CA issuer configuration"`
}

type GlobalConfig struct {
	LandingZoneConfig `yaml:",inline"`
	ClusterConfig     `yaml:",inline"`
	NetworkConfig     `yaml:",inline"`
	QuayConfig        `yaml:",inline"`
	StorageConfig     `yaml:",inline"`
	PluginsConfig     `yaml:",inline"`
}

type CertificatesConfig struct {
	// API Server
	SSLAPICertificateFullChain     *string `json:"sslAPICertificateFullChain,omitempty" yaml:"sslAPICertificateFullChain,omitempty" doc:"PEM-encoded full cert chain for API server"`
	SSLAPICertificateKey           *string `json:"sslAPICertificateKey,omitempty" yaml:"sslAPICertificateKey,omitempty" doc:"PEM-encoded private key for API server cert"`
	SSLIngressCertificateFullChain *string `json:"sslIngressCertificateFullChain,omitempty" yaml:"sslIngressCertificateFullChain,omitempty" doc:"PEM-encoded full cert chain for ingress wildcard"`
	SSLIngressCertificateKey       *string `json:"sslIngressCertificateKey,omitempty" yaml:"sslIngressCertificateKey,omitempty" doc:"PEM-encoded private key for ingress cert"`
	SSLCACertificate               *string `json:"sslCACertificate,omitempty" yaml:"sslCACertificate,omitempty" doc:"PEM-encoded root CA certificate"`

	// Baremetal Operator
	IronicHTTPSCertificate *string `json:"ironicHTTPSCertificate,omitempty" yaml:"ironicHTTPSCertificate,omitempty" doc:"PEM-encoded TLS cert for Ironic vmedia HTTPS"`
	IronicHTTPSKey         *string `json:"ironicHTTPSKey,omitempty" yaml:"ironicHTTPSKey,omitempty" doc:"PEM-encoded private key for Ironic HTTPS cert"`
}

type CloudInfraConfig struct {
	DiscoveryHosts []HostEntry `json:"discovery_hosts" yaml:"discovery_hosts" doc:"Worker nodes for hardware discovery"`
}

type EnclaveConfig struct {
	Global       GlobalConfig       `json:"global" doc:"Primary cluster configuration (global.yaml)"`
	Certificates CertificatesConfig `json:"certificates" doc:"TLS certificates (certificates.yaml)"`
	CloudInfra   CloudInfraConfig   `json:"cloudInfra" doc:"Cloud infrastructure / discovery hosts (cloud_infra.yaml)"`
}
