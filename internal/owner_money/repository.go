package owner_money

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context) ([]Entry, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			id,
			entry_type,
			amount,
			COALESCE(notes, ''),
			entry_date
		FROM owner_money
		ORDER BY entry_date DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Entry, 0)

	for rows.Next() {
		var item Entry

		if err := rows.Scan(
			&item.ID,
			&item.Type,
			&item.Amount,
			&item.Notes,
			&item.EntryDate,
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
) (Entry, error) {
	var item Entry

	err := r.db.QueryRow(ctx, `
		INSERT INTO owner_money (
			entry_type,
			amount,
			notes
		)
		VALUES ($1, $2, $3)
		RETURNING
			id,
			entry_type,
			amount,
			COALESCE(notes, ''),
			entry_date
	`,
		req.Type,
		req.Amount,
		req.Notes,
	).Scan(
		&item.ID,
		&item.Type,
		&item.Amount,
		&item.Notes,
		&item.EntryDate,
	)

	return item, err
}
