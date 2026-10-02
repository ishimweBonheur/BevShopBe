package owner_money

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
	mux.HandleFunc("GET /api/v1/owner-money", h.list)
	mux.HandleFunc("POST /api/v1/owner-money", h.create)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.List(r.Context())
	if err != nil {
		httpx.Error(w, 500, "failed to load owner money")
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
		case errors.Is(err, ErrInvalidType),
			errors.Is(err, ErrInvalidAmount):
			httpx.Error(w, 400, err.Error())

		default:
			httpx.Error(w, 500, "failed to record owner money")
		}

		return
	}

	httpx.JSON(w, 201, item)
}
