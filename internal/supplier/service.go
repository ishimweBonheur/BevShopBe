package supplier

import (
	"context"
	"errors"
	"strings"
)

var ErrNameRequired = errors.New("supplier name is required")

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context) ([]Supplier, error) {
	return s.repo.List(ctx)
}

func (s *Service) Create(ctx context.Context, req CreateRequest) (Supplier, error) {
	req.Name = strings.TrimSpace(req.Name)

	if req.Name == "" {
		return Supplier{}, ErrNameRequired
	}

	return s.repo.Create(ctx, req)
}

func (s *Service) Update(
	ctx context.Context,
	id string,
	req UpdateRequest,
) (Supplier, error) {
	req.Name = strings.TrimSpace(req.Name)

	if req.Name == "" {
		return Supplier{}, ErrNameRequired
	}

	return s.repo.Update(ctx, id, req)
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}
