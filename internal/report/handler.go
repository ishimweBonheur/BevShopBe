package report

import (
	"bevshop/internal/httpx"
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
	mux.HandleFunc("GET /api/v1/reports/summary", h.summary)
	mux.HandleFunc("GET /api/v1/reports/print", h.printable)
	mux.HandleFunc("GET /api/v1/reports/dashboard", h.dashboard)
	mux.HandleFunc("GET /api/v1/history", h.history)
}

func (h *Handler) summary(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")

	from, to, err := reportDates(r)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	result, err := h.service.Summary(r.Context(), period, from, to)
	if err != nil {
		if errors.Is(err, ErrInvalidPeriod) {
			httpx.Error(w, http.StatusBadRequest, "use today, week, month, year or a valid from/to range")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "failed to generate report")
		return
	}

	httpx.JSON(w, http.StatusOK, result)
}

func (h *Handler) dashboard(w http.ResponseWriter, r *http.Request) {
	var from, to *time.Time
	if rawFrom := r.URL.Query().Get("from"); rawFrom != "" {
		if parsed, err := time.Parse(time.RFC3339, rawFrom); err == nil {
			from = &parsed
		}
	}
	if rawTo := r.URL.Query().Get("to"); rawTo != "" {
		if parsed, err := time.Parse(time.RFC3339, rawTo); err == nil {
			to = &parsed
		}
	}

	result, err := h.service.Dashboard(r.Context(), from, to)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to generate dashboard")
		return
	}

	httpx.JSON(w, http.StatusOK, result)
}

func (h *Handler) history(w http.ResponseWriter, r *http.Request) {
	var from, to *time.Time
	if rawFrom := r.URL.Query().Get("from"); rawFrom != "" {
		if parsed, err := time.Parse(time.RFC3339, rawFrom); err == nil {
			from = &parsed
		}
	}
	if rawTo := r.URL.Query().Get("to"); rawTo != "" {
		if parsed, err := time.Parse(time.RFC3339, rawTo); err == nil {
			to = &parsed
		}
	}

	limit := 50
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	result, err := h.service.History(r.Context(), from, to, limit)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load history")
		return
	}

	httpx.JSON(w, http.StatusOK, result)
}

func (h *Handler) printable(w http.ResponseWriter, r *http.Request) {
	from, to, err := reportDates(r)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	result, err := h.service.Printable(r.Context(), r.URL.Query().Get("period"), from, to)
	if err != nil {
		if errors.Is(err, ErrInvalidPeriod) {
			httpx.Error(w, 400, "use today, week, month, year or a valid from/to range")
			return
		}
		httpx.Error(w, 500, "failed to generate printable report")
		return
	}
	httpx.JSON(w, 200, result)
}

// Date-only ranges include the entire final day in Kigali. Timestamp ends are exclusive.
func reportDates(r *http.Request) (*time.Time, *time.Time, error) {
	zone, err := time.LoadLocation("Africa/Kigali")
	if err != nil {
		return nil, nil, err
	}
	var from, to *time.Time
	for _, name := range []string{"from", "to"} {
		raw := r.URL.Query().Get(name)
		if raw == "" {
			continue
		}
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			parsed, err = time.ParseInLocation("2006-01-02", raw, zone)
			if err != nil {
				return nil, nil, errors.New("dates must be YYYY-MM-DD or RFC3339 timestamps")
			}
			if name == "to" {
				parsed = parsed.AddDate(0, 0, 1)
			}
		}
		if name == "from" {
			from = &parsed
		} else {
			to = &parsed
		}
	}
	return from, to, nil
}
