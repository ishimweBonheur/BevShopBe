package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrSetupRequired     = errors.New("setup required")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrInvalidName       = errors.New("name is required")
	ErrInvalidEmail      = errors.New("email is required")
	ErrInvalidPassword   = errors.New("password must be at least 6 characters")
	ErrCurrentPassword   = errors.New("current password is invalid")
)

type Service struct {
	repo   *Repository
	secret string
}

func NewService(repo *Repository, secret string) *Service {
	return &Service{repo: repo, secret: secret}
}

func (s *Service) Setup(ctx context.Context, req SetupRequest) (LoginResponse, error) {
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Phone = strings.TrimSpace(req.Phone)
	if req.Name == "" {
		return LoginResponse{}, ErrInvalidName
	}
	if req.Email == "" {
		return LoginResponse{}, ErrInvalidEmail
	}
	if len(req.Password) < 6 {
		return LoginResponse{}, ErrInvalidPassword
	}

	hasUser, err := s.repo.HasAnyUser(ctx)
	if err != nil {
		return LoginResponse{}, err
	}
	if hasUser {
		return LoginResponse{}, ErrUserAlreadyExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return LoginResponse{}, err
	}

	user, err := s.repo.Create(ctx, req.Name, req.Email, req.Phone, string(hash))
	if err != nil {
		return LoginResponse{}, err
	}

	return s.issueToken(user)
}

func (s *Service) Login(ctx context.Context, req LoginRequest) (LoginResponse, error) {
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" {
		return LoginResponse{}, ErrInvalidEmail
	}
	if len(req.Password) < 6 {
		return LoginResponse{}, ErrInvalidPassword
	}

	user, passwordHash, err := s.repo.GetByEmail(ctx, req.Email)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return LoginResponse{}, ErrInvalidCredentials
		}
		return LoginResponse{}, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		return LoginResponse{}, ErrInvalidCredentials
	}

	return s.issueToken(user)
}

func (s *Service) Me(ctx context.Context, userID string) (User, error) {
	return s.repo.GetByID(ctx, userID)
}

func (s *Service) UpdateProfile(ctx context.Context, userID string, req ProfileRequest) (User, error) {
	req.Name = strings.TrimSpace(req.Name)
	req.Phone = strings.TrimSpace(req.Phone)
	if req.Name == "" {
		return User{}, ErrInvalidName
	}
	return s.repo.UpdateProfile(ctx, userID, req.Name, req.Phone)
}

func (s *Service) UpdatePassword(ctx context.Context, userID string, req PasswordRequest) error {
	if len(req.NewPassword) < 6 {
		return ErrInvalidPassword
	}

	_, passwordHash, err := s.repo.GetByEmail(ctx, s.emailFromID(ctx, userID))
	if err != nil {
		return err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.CurrentPassword)); err != nil {
		return ErrCurrentPassword
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.repo.UpdatePassword(ctx, userID, string(hash))
}

func (s *Service) emailFromID(ctx context.Context, userID string) string {
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return ""
	}
	return user.Email
}

func (s *Service) issueToken(user User) (LoginResponse, error) {
	token, err := newToken(s.secret, Claims{UserID: user.ID, Email: user.Email, Iat: time.Now().Unix(), Exp: time.Now().Add(24 * time.Hour).Unix()})
	if err != nil {
		return LoginResponse{}, err
	}
	return LoginResponse{Token: token, User: user}, nil
}

func newToken(secret string, claims Claims) (string, error) {
	if secret == "" {
		secret = "bevshop-local-secret"
	}
	header := base64URLEncode([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload, err := base64URLEncodeJSON(claims)
	if err != nil {
		return "", err
	}
	signingInput := fmt.Sprintf("%s.%s", header, payload)
	signature := hmacSHA256(secret, signingInput)
	return fmt.Sprintf("%s.%s", signingInput, signature), nil
}
