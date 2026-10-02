package category

import (
	"context"
	"errors"
	"strings"
)

var ErrInvalidName = errors.New("category name is required")

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{
		repo: repo,
	}
}

func (s *Service) List(ctx context.Context) ([]Category, error) {
	return s.repo.List(ctx)
}

func (s *Service) Create(
	ctx context.Context,
	req CreateRequest,
) (Category, error) {
	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)

	if req.Name == "" {
		return Category{}, ErrInvalidName
	}

	return s.repo.Create(ctx, req)
}

func (s *Service) Update(
	ctx context.Context,
	id string,
	req UpdateRequest,
) (Category, error) {
	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)

	if req.Name == "" {
		return Category{}, ErrInvalidName
	}

	return s.repo.Update(ctx, id, req)
}

func (s *Service) Delete(
	ctx context.Context,
	id string,
) error {
	return s.repo.Delete(ctx, id)
}
