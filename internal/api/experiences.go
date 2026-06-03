package api

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/rh-ecosystem-edge/enclave-wizard/internal/models"
)

type ExperiencesHandler struct {
	experiences []models.Experience
}

func NewExperiencesHandler(experiences []models.Experience) *ExperiencesHandler {
	return &ExperiencesHandler{experiences: experiences}
}

type ExperiencesOutput struct {
	Body struct {
		Experiences []models.Experience `json:"experiences" doc:"Available experiences"`
	}
}

func (h *ExperiencesHandler) Register(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "list-experiences",
		Method:      http.MethodGet,
		Path:        "/api/v1/experiences",
		Summary:     "List available experiences",
		Description: "Returns experience bundles loaded from the enclave directory.",
		Tags:        []string{"Experiences"},
	}, h.list)
}

func (h *ExperiencesHandler) list(_ context.Context, _ *struct{}) (*ExperiencesOutput, error) {
	out := &ExperiencesOutput{}
	out.Body.Experiences = h.experiences
	return out, nil
}
