package sale

import (
	"context"
	"errors"
	"strings"
	"time"
)

var (
	ErrItemsRequired        = errors.New("at least one sale item is required")
	ErrInvalidQuantity      = errors.New("quantity must be greater than zero")
	ErrInvalidSellingPrice  = errors.New("selling price must be greater than zero")
	ErrInvalidPaymentMethod = errors.New("invalid payment method")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, from, to *time.Time, paymentMethod string, limit, offset int) ([]Sale, error) {
	return s.repo.List(ctx, from, to, paymentMethod, limit, offset)
}

func (s *Service) GetByID(ctx context.Context, id string) (Sale, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *Service) Create(ctx context.Context, req CreateRequest) (Sale, error) {
	req.PaymentMethod = strings.TrimSpace(req.PaymentMethod)
	req.Notes = strings.TrimSpace(req.Notes)

	switch req.PaymentMethod {
	case "cash", "mobile_money", "bank":
	default:
		return Sale{}, ErrInvalidPaymentMethod
	}

	if len(req.Items) == 0 {
		return Sale{}, ErrItemsRequired
	}

	for _, item := range req.Items {
		if item.Quantity <= 0 {
			return Sale{}, ErrInvalidQuantity
		}

		if item.SellingPrice <= 0 {
			return Sale{}, ErrInvalidSellingPrice
		}
	}

	return s.repo.Create(ctx, req)
}
