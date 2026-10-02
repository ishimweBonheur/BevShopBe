package category

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
	return &Handler{
		service: service,
	}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/categories", h.list)
	mux.HandleFunc("POST /api/v1/categories", h.create)
	mux.HandleFunc("PUT /api/v1/categories/{id}", h.update)
	mux.HandleFunc("DELETE /api/v1/categories/{id}", h.delete)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.List(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load categories")
		return
	}

	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req CreateRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	item, err := h.service.Create(r.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidName):
			httpx.Error(w, http.StatusBadRequest, err.Error())

		case errors.Is(err, ErrAlreadyExists):
			httpx.Error(w, http.StatusConflict, "category already exists")

		default:
			httpx.Error(w, http.StatusInternalServerError, "failed to create category")
		}

		return
	}

	httpx.JSON(w, http.StatusCreated, item)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var req UpdateRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	item, err := h.service.Update(r.Context(), id, req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidName):
			httpx.Error(w, http.StatusBadRequest, err.Error())

		case errors.Is(err, ErrAlreadyExists):
			httpx.Error(w, http.StatusConflict, "category already exists")

		case errors.Is(err, ErrNotFound):
			httpx.Error(w, http.StatusNotFound, "category not found")

		default:
			httpx.Error(w, http.StatusInternalServerError, "failed to update category")
		}

		return
	}

	httpx.JSON(w, http.StatusOK, item)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	err := h.service.Delete(r.Context(), id)
	if err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			httpx.Error(w, http.StatusNotFound, "category not found")

		case errors.Is(err, ErrCategoryInUse):
			httpx.Error(
				w,
				http.StatusConflict,
				"category cannot be deleted because it has products",
			)

		default:
			httpx.Error(w, http.StatusInternalServerError, "failed to delete category")
		}

		return
	}

	w.WriteHeader(http.StatusNoContent)
}
