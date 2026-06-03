package models

type ExperiencePlugin struct {
	Name string `json:"name" yaml:"name" doc:"Plugin name"`
}

type Experience struct {
	Name        string             `json:"name" yaml:"name" doc:"Experience identifier"`
	Description string             `json:"description,omitempty" yaml:"description,omitempty" doc:"Human-readable description"`
	Plugins     []ExperiencePlugin `json:"plugins" yaml:"plugins" doc:"Plugins included in this experience"`
}
