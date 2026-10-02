package product

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
	mux.HandleFunc("GET /api/v1/products", h.list)
	mux.HandleFunc("GET /api/v1/products/{id}", h.get)
	mux.HandleFunc("POST /api/v1/products", h.create)
	mux.HandleFunc("PUT /api/v1/products/{id}", h.update)
	mux.HandleFunc("PATCH /api/v1/products/{id}/deactivate", h.deactivate)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.List(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load products")
		return
	}

	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	item, err := h.service.GetByID(
		r.Context(),
		r.PathValue("id"),
	)

	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "product not found")
			return
		}

		httpx.Error(w, http.StatusInternalServerError, "failed to load product")
		return
	}

	httpx.JSON(w, http.StatusOK, item)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req CreateRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	item, err := h.service.Create(r.Context(), req)

	if err != nil {
		writeProductError(w, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, item)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	var req UpdateRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	item, err := h.service.Update(
		r.Context(),
		r.PathValue("id"),
		req,
	)

	if err != nil {
		writeProductError(w, err)
		return
	}

	httpx.JSON(w, http.StatusOK, item)
}

func (h *Handler) deactivate(w http.ResponseWriter, r *http.Request) {
	err := h.service.Deactivate(
		r.Context(),
		r.PathValue("id"),
	)

	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "product not found")
			return
		}

		httpx.Error(w, http.StatusInternalServerError, "failed to deactivate product")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{
		"message": "product deactivated successfully",
	})
}

func writeProductError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNameRequired),
		errors.Is(err, ErrCategoryRequired),
		errors.Is(err, ErrInvalidUnitsPerPack),
		errors.Is(err, ErrInvalidSellingPrice),
		errors.Is(err, ErrInvalidLowStockLevel):

		httpx.Error(w, http.StatusBadRequest, err.Error())

	case errors.Is(err, ErrAlreadyExists):
		httpx.Error(w, http.StatusConflict, "product already exists")

	case errors.Is(err, ErrCategoryNotFound):
		httpx.Error(w, http.StatusBadRequest, "selected category does not exist")

	case errors.Is(err, ErrNotFound):
		httpx.Error(w, http.StatusNotFound, "product not found")

	default:
		httpx.Error(w, http.StatusInternalServerError, "something went wrong")
	}
}
