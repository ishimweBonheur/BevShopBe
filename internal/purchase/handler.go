package purchase

import (
	"bevshop/internal/httpx"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/purchases", h.list)
	mux.HandleFunc("GET /api/v1/purchases/{id}", h.get)
	mux.HandleFunc("POST /api/v1/purchases", h.create)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	var from, to *time.Time
	if raw := r.URL.Query().Get("from"); raw != "" {
		if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
			from = &parsed
		}
	}
	if raw := r.URL.Query().Get("to"); raw != "" {
		if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
			to = &parsed
		}
	}

	limit := 50
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	offset := 0
	if raw := r.URL.Query().Get("offset"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	items, err := h.service.List(r.Context(), from, to, r.URL.Query().Get("supplier_id"), limit, offset)
	if err != nil {
		log.Printf("failed to load purchases: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "failed to load purchases")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	item, err := h.service.GetByID(r.Context(), r.PathValue("id"))
	if err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			httpx.Error(w, http.StatusNotFound, "purchase not found")
		default:
			httpx.Error(w, http.StatusInternalServerError, "failed to load purchase")
		}
		return
	}
	httpx.JSON(w, http.StatusOK, item)
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
		case errors.Is(err, ErrSupplierRequired),
			errors.Is(err, ErrItemsRequired),
			errors.Is(err, ErrInvalidPacks),
			errors.Is(err, ErrInvalidPrice):
			httpx.Error(w, 400, err.Error())

		case errors.Is(err, ErrSupplierNotFound):
			httpx.Error(w, 404, "supplier not found")

		case errors.Is(err, ErrProductNotFound):
			httpx.Error(w, 404, "product not found")

		default:
			httpx.Error(w, 500, "failed to record purchase")
		}

		return
	}

	httpx.JSON(w, 201, item)
}
