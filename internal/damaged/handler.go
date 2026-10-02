package damaged

import (
	"bevshop/internal/httpx"
	"encoding/json"
	"errors"
	"net/http"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/damaged-items", h.list)
	mux.HandleFunc("POST /api/v1/damaged-items", h.create)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.List(r.Context())
	if err != nil {
		httpx.Error(w, 500, "failed to load damaged items")
		return
	}

	httpx.JSON(w, 200, items)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req CreateRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, 400, "invalid request body")
		return
	}

	item, err := h.service.Create(r.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrProductRequired),
			errors.Is(err, ErrInvalidQuantity):
			httpx.Error(w, 400, err.Error())

		case errors.Is(err, ErrProductNotFound):
			httpx.Error(w, 404, "product not found")

		case errors.Is(err, ErrInsufficientStock):
			httpx.Error(w, 409, err.Error())

		default:
			httpx.Error(w, 500, "failed to record damaged item")
		}
		return
	}

	httpx.JSON(w, 201, item)
}
