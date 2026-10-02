package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"bevshop/internal/httpx"

	"github.com/redis/go-redis/v9"
)

var ErrUnauthorized = errors.New("unauthorized")

type Middleware struct {
	secret string
	redis  *redis.Client
}

type contextKey string

const userContextKey contextKey = "auth_user"

func NewMiddleware(secret string, redisClient *redis.Client) *Middleware {
	return &Middleware{secret: secret, redis: redisClient}
}

func (m *Middleware) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isPublicRoute(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		token, ok := bearerToken(r)
		if !ok {
			httpx.Error(w, http.StatusUnauthorized, "authentication required")
			return
		}

		claims, err := parseToken(m.secret, token)
		if err != nil {
			httpx.Error(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		if m.redis != nil {
			if revoked, err := m.redis.Exists(r.Context(), "revoked:"+token).Result(); err == nil && revoked > 0 {
				httpx.Error(w, http.StatusUnauthorized, "session revoked")
				return
			}
		}

		ctx := context.WithValue(r.Context(), userContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func CurrentUser(r *http.Request) (Claims, bool) {
	claims, ok := r.Context().Value(userContextKey).(Claims)
	return claims, ok
}

func bearerToken(r *http.Request) (string, bool) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return "", false
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return "", false
	}
	return strings.TrimSpace(parts[1]), true
}

func isPublicRoute(path string) bool {
	if path == "/health" || path == "/openapi.json" || path == "/swagger" || strings.HasPrefix(path, "/swagger/") ||
		path == "/api/docs" || strings.HasPrefix(path, "/api/docs/") ||
		path == "/api/docs/openapi.json" {
		return true
	}
	if path == "/api/v1/auth/setup" || path == "/api/v1/auth/login" {
		return true
	}
	return false
}

func parseToken(secret, token string) (Claims, error) {
	if secret == "" {
		secret = "bevshop-local-secret"
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return Claims{}, ErrUnauthorized
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return Claims{}, err
	}
	var claims Claims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return Claims{}, err
	}
	expected := hmacSHA256(secret, parts[0]+"."+parts[1])
	if !hmac.Equal([]byte(expected), []byte(parts[2])) {
		return Claims{}, ErrUnauthorized
	}
	if claims.Exp != 0 && time.Unix(claims.Exp, 0).Before(time.Now()) {
		return Claims{}, ErrUnauthorized
	}
	return claims, nil
}

func hmacSHA256(secret, input string) string {
	h := hmac.New(sha256.New, []byte(secret))
	_, _ = h.Write([]byte(input))
	return base64.RawURLEncoding.EncodeToString(h.Sum(nil))
}

func base64URLEncodeJSON(v any) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func base64URLEncode(b []byte) string {
	return base64.RawURLEncoding.EncodeToString(b)
}
