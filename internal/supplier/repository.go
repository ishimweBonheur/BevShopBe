package supplier

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound      = errors.New("supplier not found")
	ErrAlreadyExists = errors.New("supplier already exists")
	ErrInUse         = errors.New("supplier has purchase history")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context) ([]Supplier, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, name,
		       COALESCE(phone,''),
		       COALESCE(email,''),
		       COALESCE(address,''),
		       COALESCE(notes,''),
		       created_at, updated_at
		FROM suppliers
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Supplier, 0)

	for rows.Next() {
		var item Supplier

		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Phone,
			&item.Email,
			&item.Address,
			&item.Notes,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}

		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *Repository) Create(ctx context.Context, req CreateRequest) (Supplier, error) {
	var item Supplier

	err := r.db.QueryRow(ctx, `
		INSERT INTO suppliers(name, phone, email, address, notes)
		VALUES($1,$2,$3,$4,$5)
		RETURNING id, name,
		          COALESCE(phone,''),
		          COALESCE(email,''),
		          COALESCE(address,''),
		          COALESCE(notes,''),
		          created_at, updated_at
	`,
		req.Name,
		req.Phone,
		req.Email,
		req.Address,
		req.Notes,
	).Scan(
		&item.ID,
		&item.Name,
		&item.Phone,
		&item.Email,
		&item.Address,
		&item.Notes,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if isUniqueViolation(err) {
		return Supplier{}, ErrAlreadyExists
	}

	return item, err
}

func (r *Repository) Update(
	ctx context.Context,
	id string,
	req UpdateRequest,
) (Supplier, error) {
	var item Supplier

	err := r.db.QueryRow(ctx, `
		UPDATE suppliers
		SET name=$2,
		    phone=$3,
		    email=$4,
		    address=$5,
		    notes=$6,
		    updated_at=now()
		WHERE id=$1
		RETURNING id, name,
		          COALESCE(phone,''),
		          COALESCE(email,''),
		          COALESCE(address,''),
		          COALESCE(notes,''),
		          created_at, updated_at
	`,
		id,
		req.Name,
		req.Phone,
		req.Email,
		req.Address,
		req.Notes,
	).Scan(
		&item.ID,
		&item.Name,
		&item.Phone,
		&item.Email,
		&item.Address,
		&item.Notes,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return Supplier{}, ErrNotFound
	}

	if isUniqueViolation(err) {
		return Supplier{}, ErrAlreadyExists
	}

	return item, err
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	var count int

	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM purchases
		WHERE supplier_id=$1
	`, id).Scan(&count)
	if err != nil {
		return err
	}

	if count > 0 {
		return ErrInUse
	}

	result, err := r.db.Exec(ctx, `
		DELETE FROM suppliers WHERE id=$1
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
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
