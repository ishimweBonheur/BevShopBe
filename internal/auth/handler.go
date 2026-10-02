package auth

import (
	"bevshop/internal/httpx"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

type Handler struct {
	service *Service
	redis   *redis.Client
}

func NewHandler(service *Service, redisClient ...*redis.Client) *Handler {
	var client *redis.Client
	if len(redisClient) > 0 {
		client = redisClient[0]
	}
	return &Handler{service: service, redis: client}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/auth/setup", h.setup)
	mux.HandleFunc("POST /api/v1/auth/login", h.login)
	mux.HandleFunc("POST /api/v1/auth/logout", h.logout)
	mux.HandleFunc("GET /api/v1/auth/me", h.me)
	mux.HandleFunc("PUT /api/v1/auth/profile", h.profile)
	mux.HandleFunc("PUT /api/v1/auth/password", h.password)
}

func (h *Handler) setup(w http.ResponseWriter, r *http.Request) {
	var req SetupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	resp, err := h.service.Setup(r.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidName), errors.Is(err, ErrInvalidEmail), errors.Is(err, ErrInvalidPassword):
			httpx.Error(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, ErrUserAlreadyExists):
			httpx.Error(w, http.StatusConflict, "shop owner already set up")
		default:
			httpx.Error(w, http.StatusInternalServerError, "failed to set up shop")
		}
		return
	}

	httpx.JSON(w, http.StatusCreated, resp)
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	resp, err := h.service.Login(r.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidEmail), errors.Is(err, ErrInvalidPassword), errors.Is(err, ErrInvalidCredentials):
			httpx.Error(w, http.StatusUnauthorized, err.Error())
		default:
			httpx.Error(w, http.StatusInternalServerError, "failed to log in")
		}
		return
	}

	httpx.JSON(w, http.StatusOK, resp)
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	claims, ok := CurrentUser(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "authentication required")
		return
	}

	token, ok := bearerToken(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "authentication required")
		return
	}

	if h.redis != nil {
		if err := h.redis.Set(r.Context(), "revoked:"+token, true, 24*time.Hour).Err(); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "failed to log out")
			return
		}
	}

	_ = claims
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "logged out successfully"})
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	claims, ok := CurrentUser(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "authentication required")
		return
	}

	user, err := h.service.Me(r.Context(), claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "session expired")
		return
	}

	httpx.JSON(w, http.StatusOK, user)
}

func (h *Handler) profile(w http.ResponseWriter, r *http.Request) {
	claims, ok := CurrentUser(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req ProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, err := h.service.UpdateProfile(r.Context(), claims.UserID, req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidName):
			httpx.Error(w, http.StatusBadRequest, err.Error())
		default:
			httpx.Error(w, http.StatusInternalServerError, "failed to update profile")
		}
		return
	}

	httpx.JSON(w, http.StatusOK, user)
}

func (h *Handler) password(w http.ResponseWriter, r *http.Request) {
	claims, ok := CurrentUser(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req PasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.service.UpdatePassword(r.Context(), claims.UserID, req); err != nil {
		switch {
		case errors.Is(err, ErrInvalidPassword):
			httpx.Error(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, ErrCurrentPassword):
			httpx.Error(w, http.StatusUnauthorized, err.Error())
		default:
			httpx.Error(w, http.StatusInternalServerError, "failed to update password")
		}
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{"message": "password updated successfully"})
}
