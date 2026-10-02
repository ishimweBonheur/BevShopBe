package expense

import (
	"context"
	"errors"
	"strings"
)

var (
	ErrNameRequired  = errors.New("expense name is required")
	ErrInvalidAmount = errors.New("amount must be greater than zero")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context) ([]Expense, error) {
	return s.repo.List(ctx)
}

func (s *Service) Create(
	ctx context.Context,
	req CreateRequest,
) (Expense, error) {
	clean(&req)

	if err := validate(req.Name, req.Amount); err != nil {
		return Expense{}, err
	}

	return s.repo.Create(ctx, req)
}

func (s *Service) Update(
	ctx context.Context,
	id string,
	req UpdateRequest,
) (Expense, error) {
	clean(&req)

	if err := validate(req.Name, req.Amount); err != nil {
		return Expense{}, err
	}

	return s.repo.Update(ctx, id, req)
}

func clean(req *CreateRequest) {
	req.Name = strings.TrimSpace(req.Name)
	req.Category = strings.TrimSpace(req.Category)
	req.Description = strings.TrimSpace(req.Description)
}

func validate(name string, amount float64) error {
	if name == "" {
		return ErrNameRequired
	}

	if amount <= 0 {
		return ErrInvalidAmount
	}

	return nil
}
