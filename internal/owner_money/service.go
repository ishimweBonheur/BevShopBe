package owner_money

import (
	"context"
	"errors"
	"strings"
)

var (
	ErrInvalidType   = errors.New("type must be money_added or money_taken")
	ErrInvalidAmount = errors.New("amount must be greater than zero")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context) ([]Entry, error) {
	return s.repo.List(ctx)
}

func (s *Service) Create(
	ctx context.Context,
	req CreateRequest,
) (Entry, error) {
	req.Type = strings.TrimSpace(req.Type)
	req.Notes = strings.TrimSpace(req.Notes)

	if req.Type != "money_added" && req.Type != "money_taken" {
		return Entry{}, ErrInvalidType
	}

	if req.Amount <= 0 {
		return Entry{}, ErrInvalidAmount
	}

	return s.repo.Create(ctx, req)
}
