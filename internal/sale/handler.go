package sale

import (
	"bevshop/internal/httpx"
	"encoding/json"
	"errors"
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
	mux.HandleFunc("GET /api/v1/sales", h.list)
	mux.HandleFunc("GET /api/v1/sales/{id}", h.get)
	mux.HandleFunc("POST /api/v1/sales", h.create)
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

	items, err := h.service.List(r.Context(), from, to, r.URL.Query().Get("payment_method"), limit, offset)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load sales")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	item, err := h.service.GetByID(r.Context(), r.PathValue("id"))
	if err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			httpx.Error(w, http.StatusNotFound, "sale not found")
		default:
			httpx.Error(w, http.StatusInternalServerError, "failed to load sale")
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
		case errors.Is(err, ErrItemsRequired),
			errors.Is(err, ErrInvalidQuantity),
			errors.Is(err, ErrInvalidSellingPrice),
			errors.Is(err, ErrInvalidPaymentMethod):
			httpx.Error(w, 400, err.Error())

		case errors.Is(err, ErrProductNotFound):
			httpx.Error(w, 404, "product not found")

		case errors.Is(err, ErrInsufficientStock):
			httpx.Error(w, 409, err.Error())

		default:
			httpx.Error(w, 500, "failed to record sale")
		}

		return
	}

	httpx.JSON(w, 201, item)
}
