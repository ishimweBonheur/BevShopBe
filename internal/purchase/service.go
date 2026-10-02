package purchase

import (
	"context"
	"errors"
	"strings"
	"time"
)

var (
	ErrSupplierRequired = errors.New("supplier is required")
	ErrItemsRequired    = errors.New("at least one purchase item is required")
	ErrInvalidPacks     = errors.New("packs must be greater than zero")
	ErrInvalidPrice     = errors.New("price per pack must be greater than zero")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, from, to *time.Time, supplierID string, limit, offset int) ([]Purchase, error) {
	return s.repo.List(ctx, from, to, supplierID, limit, offset)
}

func (s *Service) GetByID(ctx context.Context, id string) (Purchase, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *Service) Create(ctx context.Context, req CreateRequest) (Purchase, error) {
	req.SupplierID = strings.TrimSpace(req.SupplierID)
	req.Notes = strings.TrimSpace(req.Notes)

	if req.SupplierID == "" {
		return Purchase{}, ErrSupplierRequired
	}

	if len(req.Items) == 0 {
		return Purchase{}, ErrItemsRequired
	}

	for _, item := range req.Items {
		if item.Packs <= 0 {
			return Purchase{}, ErrInvalidPacks
		}

		if item.PricePerPack <= 0 {
			return Purchase{}, ErrInvalidPrice
		}
	}

	return s.repo.Create(ctx, req)
}
