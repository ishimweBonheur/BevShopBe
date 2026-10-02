package damaged

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrProductNotFound   = errors.New("product not found")
	ErrInsufficientStock = errors.New("insufficient stock")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context) ([]Record, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			d.id,
			d.product_id,
			p.name,
			d.quantity,
			COALESCE(d.reason, ''),
			d.cost_per_item,
			d.total_loss,
			d.damaged_date
		FROM damaged_items d
		JOIN products p ON p.id = d.product_id
		ORDER BY d.damaged_date DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Record, 0)

	for rows.Next() {
		var item Record

		if err := rows.Scan(
			&item.ID,
			&item.ProductID,
			&item.ProductName,
			&item.Quantity,
			&item.Reason,
			&item.CostPerItem,
			&item.TotalLoss,
			&item.DamagedDate,
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
) (Record, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Record{}, err
	}

	defer func() {
		_ = tx.Rollback(ctx)
	}()

	var productName string
	var currentStock int
	var costPerItem float64

	err = tx.QueryRow(ctx, `
		SELECT
			name,
			current_stock,
			average_cost_per_item
		FROM products
		WHERE id = $1
		  AND is_active = TRUE
		FOR UPDATE
	`, req.ProductID).Scan(
		&productName,
		&currentStock,
		&costPerItem,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return Record{}, ErrProductNotFound
	}

	if err != nil {
		return Record{}, err
	}

	if req.Quantity > currentStock {
		return Record{}, fmt.Errorf(
			"%w: %s has only %d items available",
			ErrInsufficientStock,
			productName,
			currentStock,
		)
	}

	totalLoss := float64(req.Quantity) * costPerItem

	var item Record

	err = tx.QueryRow(ctx, `
		INSERT INTO damaged_items (
			product_id,
			quantity,
			reason,
			cost_per_item,
			total_loss
		)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING
			id,
			product_id,
			quantity,
			COALESCE(reason, ''),
			cost_per_item,
			total_loss,
			damaged_date
	`,
		req.ProductID,
		req.Quantity,
		req.Reason,
		costPerItem,
		totalLoss,
	).Scan(
		&item.ID,
		&item.ProductID,
		&item.Quantity,
		&item.Reason,
		&item.CostPerItem,
		&item.TotalLoss,
		&item.DamagedDate,
	)
	if err != nil {
		return Record{}, err
	}

	_, err = tx.Exec(ctx, `
		UPDATE products
		SET
			current_stock = current_stock - $2,
			updated_at = now()
		WHERE id = $1
	`,
		req.ProductID,
		req.Quantity,
	)
	if err != nil {
		return Record{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return Record{}, err
	}

	item.ProductName = productName

	return item, nil
}
