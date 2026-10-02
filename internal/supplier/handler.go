package supplier

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
	mux.HandleFunc("GET /api/v1/suppliers", h.list)
	mux.HandleFunc("POST /api/v1/suppliers", h.create)
	mux.HandleFunc("PUT /api/v1/suppliers/{id}", h.update)
	mux.HandleFunc("DELETE /api/v1/suppliers/{id}", h.delete)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.List(r.Context())
	if err != nil {
		httpx.Error(w, 500, "failed to load suppliers")
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
		case errors.Is(err, ErrNameRequired):
			httpx.Error(w, 400, err.Error())
		case errors.Is(err, ErrAlreadyExists):
			httpx.Error(w, 409, "supplier already exists")
		default:
			httpx.Error(w, 500, "failed to create supplier")
		}
		return
	}

	httpx.JSON(w, 201, item)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	var req UpdateRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, 400, "invalid request body")
		return
	}

	item, err := h.service.Update(r.Context(), r.PathValue("id"), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrNameRequired):
			httpx.Error(w, 400, err.Error())
		case errors.Is(err, ErrAlreadyExists):
			httpx.Error(w, 409, "supplier already exists")
		case errors.Is(err, ErrNotFound):
			httpx.Error(w, 404, "supplier not found")
		default:
			httpx.Error(w, 500, "failed to update supplier")
		}
		return
	}

	httpx.JSON(w, 200, item)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	err := h.service.Delete(r.Context(), r.PathValue("id"))
	if err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			httpx.Error(w, 404, "supplier not found")
		case errors.Is(err, ErrInUse):
			httpx.Error(w, 409, "supplier cannot be deleted because it has purchase history")
		default:
			httpx.Error(w, 500, "failed to delete supplier")
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
