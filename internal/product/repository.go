package product

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound         = errors.New("product not found")
	ErrAlreadyExists    = errors.New("product already exists")
	ErrCategoryNotFound = errors.New("category not found")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

const selectProduct = `
	SELECT
		p.id,
		p.category_id,
		c.name,
		p.name,
		COALESCE(p.description, ''),
		p.units_per_pack,
		p.selling_price,
		p.average_cost_per_item,
		p.current_stock,
		p.low_stock_level,
		p.is_active,
		p.created_at,
		p.updated_at
	FROM products p
	JOIN categories c ON c.id = p.category_id
`

func (r *Repository) List(ctx context.Context) ([]Product, error) {
	rows, err := r.db.Query(ctx, selectProduct+`
		ORDER BY p.name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Product, 0)

	for rows.Next() {
		var item Product

		if err := scanProduct(rows, &item); err != nil {
			return nil, err
		}

		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *Repository) GetByID(
	ctx context.Context,
	id string,
) (Product, error) {
	var item Product

	row := r.db.QueryRow(ctx, selectProduct+`
		WHERE p.id = $1
	`, id)

	if err := scanProduct(row, &item); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Product{}, ErrNotFound
		}

		return Product{}, err
	}

	return item, nil
}

func (r *Repository) Create(
	ctx context.Context,
	req CreateRequest,
) (Product, error) {
	var id string

	err := r.db.QueryRow(ctx, `
		INSERT INTO products (
			name,
			category_id,
			description,
			units_per_pack,
			selling_price,
			low_stock_level,
			average_cost_per_item,
			current_stock
		)
		VALUES (
			$1, $2, $3, $4, $5, $6, 0, 0
		)
		RETURNING id
	`,
		req.Name,
		req.CategoryID,
		req.Description,
		req.UnitsPerPack,
		req.SellingPrice,
		req.LowStockLevel,
	).Scan(&id)

	if err != nil {
		if isUniqueViolation(err) {
			return Product{}, ErrAlreadyExists
		}

		if isForeignKeyViolation(err) {
			return Product{}, ErrCategoryNotFound
		}

		return Product{}, err
	}

	return r.GetByID(ctx, id)
}

func (r *Repository) Update(
	ctx context.Context,
	id string,
	req UpdateRequest,
) (Product, error) {
	result, err := r.db.Exec(ctx, `
		UPDATE products
		SET
			name = $2,
			category_id = $3,
			description = $4,
			units_per_pack = $5,
			selling_price = $6,
			low_stock_level = $7,
			updated_at = now()
		WHERE id = $1
	`,
		id,
		req.Name,
		req.CategoryID,
		req.Description,
		req.UnitsPerPack,
		req.SellingPrice,
		req.LowStockLevel,
	)

	if err != nil {
		if isUniqueViolation(err) {
			return Product{}, ErrAlreadyExists
		}

		if isForeignKeyViolation(err) {
			return Product{}, ErrCategoryNotFound
		}

		return Product{}, err
	}

	if result.RowsAffected() == 0 {
		return Product{}, ErrNotFound
	}

	return r.GetByID(ctx, id)
}

func (r *Repository) Deactivate(
	ctx context.Context,
	id string,
) error {
	result, err := r.db.Exec(ctx, `
		UPDATE products
		SET
			is_active = FALSE,
			updated_at = now()
		WHERE id = $1
	`, id)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
}

type scanner interface {
	Scan(dest ...any) error
}

func scanProduct(s scanner, item *Product) error {
	return s.Scan(
		&item.ID,
		&item.CategoryID,
		&item.CategoryName,
		&item.Name,
		&item.Description,
		&item.UnitsPerPack,
		&item.SellingPrice,
		&item.AverageCostPerItem,
		&item.CurrentStock,
		&item.LowStockLevel,
		&item.IsActive,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError

	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError

	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}
