package damaged

import (
	"context"
	"errors"
	"strings"
)

var (
	ErrProductRequired = errors.New("product is required")
	ErrInvalidQuantity = errors.New("quantity must be greater than zero")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context) ([]Record, error) {
	return s.repo.List(ctx)
}

func (s *Service) Create(
	ctx context.Context,
	req CreateRequest,
) (Record, error) {
	req.ProductID = strings.TrimSpace(req.ProductID)
	req.Reason = strings.TrimSpace(req.Reason)

	if req.ProductID == "" {
		return Record{}, ErrProductRequired
	}

	if req.Quantity <= 0 {
		return Record{}, ErrInvalidQuantity
	}

	return s.repo.Create(ctx, req)
}
