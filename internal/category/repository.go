package category

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound      = errors.New("category not found")
	ErrAlreadyExists = errors.New("category already exists")
	ErrCategoryInUse = errors.New("category is being used by products")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context) ([]Category, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			id,
			name,
			COALESCE(description, ''),
			created_at,
			updated_at
		FROM categories
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]Category, 0)

	for rows.Next() {
		var item Category

		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Description,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}

		categories = append(categories, item)
	}

	return categories, rows.Err()
}

func (r *Repository) GetByID(
	ctx context.Context,
	id string,
) (Category, error) {
	var item Category

	err := r.db.QueryRow(ctx, `
		SELECT
			id,
			name,
			COALESCE(description, ''),
			created_at,
			updated_at
		FROM categories
		WHERE id = $1
	`, id).Scan(
		&item.ID,
		&item.Name,
		&item.Description,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return Category{}, ErrNotFound
	}

	return item, err
}

func (r *Repository) Create(
	ctx context.Context,
	req CreateRequest,
) (Category, error) {
	var item Category

	err := r.db.QueryRow(ctx, `
		INSERT INTO categories (
			name,
			description
		)
		VALUES ($1, $2)
		RETURNING
			id,
			name,
			COALESCE(description, ''),
			created_at,
			updated_at
	`, req.Name, req.Description).Scan(
		&item.ID,
		&item.Name,
		&item.Description,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if isUniqueViolation(err) {
		return Category{}, ErrAlreadyExists
	}

	return item, err
}

func (r *Repository) Update(
	ctx context.Context,
	id string,
	req UpdateRequest,
) (Category, error) {
	var item Category

	err := r.db.QueryRow(ctx, `
		UPDATE categories
		SET
			name = $2,
			description = $3,
			updated_at = now()
		WHERE id = $1
		RETURNING
			id,
			name,
			COALESCE(description, ''),
			created_at,
			updated_at
	`, id, req.Name, req.Description).Scan(
		&item.ID,
		&item.Name,
		&item.Description,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return Category{}, ErrNotFound
	}

	if isUniqueViolation(err) {
		return Category{}, ErrAlreadyExists
	}

	return item, err
}

func (r *Repository) Delete(
	ctx context.Context,
	id string,
) error {
	var productCount int

	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM products
		WHERE category_id = $1
	`, id).Scan(&productCount)
	if err != nil {
		return err
	}

	if productCount > 0 {
		return ErrCategoryInUse
	}

	result, err := r.db.Exec(ctx, `
		DELETE FROM categories
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

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError

	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}

	return false
}
