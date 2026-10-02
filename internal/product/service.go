package product

import (
	"context"
	"errors"
	"strings"
)

var (
	ErrNameRequired         = errors.New("product name is required")
	ErrCategoryRequired     = errors.New("category is required")
	ErrInvalidUnitsPerPack  = errors.New("units per pack must be greater than zero")
	ErrInvalidSellingPrice  = errors.New("selling price cannot be negative")
	ErrInvalidLowStockLevel = errors.New("low stock level cannot be negative")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{
		repo: repo,
	}
}

func (s *Service) List(ctx context.Context) ([]Product, error) {
	return s.repo.List(ctx)
}

func (s *Service) GetByID(
	ctx context.Context,
	id string,
) (Product, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *Service) Create(
	ctx context.Context,
	req CreateRequest,
) (Product, error) {
	req.Name = strings.TrimSpace(req.Name)
	req.CategoryID = strings.TrimSpace(req.CategoryID)
	req.Description = strings.TrimSpace(req.Description)

	if err := validate(
		req.Name,
		req.CategoryID,
		req.UnitsPerPack,
		req.SellingPrice,
		req.LowStockLevel,
	); err != nil {
		return Product{}, err
	}

	return s.repo.Create(ctx, req)
}

func (s *Service) Update(
	ctx context.Context,
	id string,
	req UpdateRequest,
) (Product, error) {
	req.Name = strings.TrimSpace(req.Name)
	req.CategoryID = strings.TrimSpace(req.CategoryID)
	req.Description = strings.TrimSpace(req.Description)

	if err := validate(
		req.Name,
		req.CategoryID,
		req.UnitsPerPack,
		req.SellingPrice,
		req.LowStockLevel,
	); err != nil {
		return Product{}, err
	}

	return s.repo.Update(ctx, id, req)
}

func (s *Service) Deactivate(
	ctx context.Context,
	id string,
) error {
	return s.repo.Deactivate(ctx, id)
}

func validate(
	name string,
	categoryID string,
	unitsPerPack int,
	sellingPrice float64,
	lowStockLevel int,
) error {
	switch {
	case name == "":
		return ErrNameRequired

	case categoryID == "":
		return ErrCategoryRequired

	case unitsPerPack <= 0:
		return ErrInvalidUnitsPerPack

	case sellingPrice < 0:
		return ErrInvalidSellingPrice

	case lowStockLevel < 0:
		return ErrInvalidLowStockLevel

	default:
		return nil
	}
}
