package expense

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("expense not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context) ([]Expense, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			id,
			name,
			COALESCE(category, ''),
			COALESCE(description, ''),
			amount,
			expense_date,
			created_at
		FROM expenses
		ORDER BY expense_date DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Expense, 0)

	for rows.Next() {
		var item Expense

		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Category,
			&item.Description,
			&item.Amount,
			&item.ExpenseDate,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}

		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *Repository) Create(
	ctx context.Context,
	req CreateRequest,
) (Expense, error) {
	var item Expense

	err := r.db.QueryRow(ctx, `
		INSERT INTO expenses (
			name,
			category,
			description,
			amount
		)
		VALUES ($1, $2, $3, $4)
		RETURNING
			id,
			name,
			COALESCE(category, ''),
			COALESCE(description, ''),
			amount,
			expense_date,
			created_at
	`,
		req.Name,
		req.Category,
		req.Description,
		req.Amount,
	).Scan(
		&item.ID,
		&item.Name,
		&item.Category,
		&item.Description,
		&item.Amount,
		&item.ExpenseDate,
		&item.CreatedAt,
	)

	return item, err
}

func (r *Repository) Update(
	ctx context.Context,
	id string,
	req UpdateRequest,
) (Expense, error) {
	var item Expense

	err := r.db.QueryRow(ctx, `
		UPDATE expenses
		SET
			name = $2,
			category = $3,
			description = $4,
			amount = $5
		WHERE id = $1
		RETURNING
			id,
			name,
			COALESCE(category, ''),
			COALESCE(description, ''),
			amount,
			expense_date,
			created_at
	`,
		id,
		req.Name,
		req.Category,
		req.Description,
		req.Amount,
	).Scan(
		&item.ID,
		&item.Name,
		&item.Category,
		&item.Description,
		&item.Amount,
		&item.ExpenseDate,
		&item.CreatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return Expense{}, ErrNotFound
	}

	return item, err
}
