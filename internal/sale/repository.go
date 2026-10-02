package sale

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrProductNotFound   = errors.New("product not found")
	ErrInsufficientStock = errors.New("insufficient stock")
	ErrNotFound          = errors.New("sale not found")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(
	ctx context.Context,
	from, to *time.Time,
	paymentMethod string,
	limit, offset int,
) ([]Sale, error) {
	query := `
		SELECT
			s.id,
			s.sale_date,
			s.payment_method,
			s.total_amount,
			COALESCE(s.notes, ''),
			COALESCE(json_agg(json_build_object(
				'id', si.id,
				'product_id', si.product_id,
				'product_name', si.product_name,
				'quantity', si.quantity,
				'selling_price_per_item', si.selling_price_per_item,
				'cost_price_per_item', si.cost_price_per_item,
				'line_total', si.line_total,
				'line_cost', si.line_cost
			) ORDER BY si.id) FILTER (WHERE si.id IS NOT NULL), '[]'::json)
		FROM sales s
		LEFT JOIN sale_items si ON si.sale_id = s.id
		WHERE ($1::timestamptz IS NULL OR s.sale_date >= $1)
		  AND ($2::timestamptz IS NULL OR s.sale_date < $2)
		  AND ($3 = '' OR s.payment_method = $3)
		GROUP BY s.id
		ORDER BY s.sale_date DESC, s.id DESC
		LIMIT $4 OFFSET $5
	`

	rows, err := r.db.Query(ctx, query, from, to, paymentMethod, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Sale, 0)
	for rows.Next() {
		var item Sale
		var rawItems []byte
		if err := rows.Scan(
			&item.ID,
			&item.SaleDate,
			&item.PaymentMethod,
			&item.TotalAmount,
			&item.Notes,
			&rawItems,
		); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(rawItems, &item.Items); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) GetByID(ctx context.Context, id string) (Sale, error) {
	query := `
		SELECT
			s.id,
			s.sale_date,
			s.payment_method,
			s.total_amount,
			COALESCE(s.notes, ''),
			COALESCE(json_agg(json_build_object(
				'id', si.id,
				'product_id', si.product_id,
				'product_name', si.product_name,
				'quantity', si.quantity,
				'selling_price_per_item', si.selling_price_per_item,
				'cost_price_per_item', si.cost_price_per_item,
				'line_total', si.line_total,
				'line_cost', si.line_cost
			) ORDER BY si.id), '[]'::json)
		FROM sales s
		LEFT JOIN sale_items si ON si.sale_id = s.id
		WHERE s.id = $1
		GROUP BY s.id
	`

	var item Sale
	var rawItems []byte
	err := r.db.QueryRow(ctx, query, id).Scan(
		&item.ID,
		&item.SaleDate,
		&item.PaymentMethod,
		&item.TotalAmount,
		&item.Notes,
		&rawItems,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Sale{}, ErrNotFound
	}
	if err != nil {
		return Sale{}, err
	}
	if err := json.Unmarshal(rawItems, &item.Items); err != nil {
		return Sale{}, err
	}
	return item, nil
}

func (r *Repository) Create(
	ctx context.Context,
	req CreateRequest,
) (Sale, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Sale{}, err
	}

	defer func() {
		_ = tx.Rollback(ctx)
	}()

	var saleID string

	err = tx.QueryRow(ctx, `
		INSERT INTO sales(
			payment_method,
			total_amount,
			notes
		)
		VALUES($1,0,$2)
		RETURNING id
	`,
		req.PaymentMethod,
		req.Notes,
	).Scan(&saleID)
	if err != nil {
		return Sale{}, err
	}

	totalSale := 0.0
	items := make([]SaleItem, 0, len(req.Items))

	for _, input := range req.Items {
		var productName string
		var currentStock int
		var costPrice float64

		err = tx.QueryRow(ctx, `
			SELECT
				name,
				current_stock,
				average_cost_per_item
			FROM products
			WHERE id=$1
			  AND is_active=TRUE
			FOR UPDATE
		`, input.ProductID).Scan(
			&productName,
			&currentStock,
			&costPrice,
		)

		if errors.Is(err, pgx.ErrNoRows) {
			return Sale{}, ErrProductNotFound
		}

		if err != nil {
			return Sale{}, err
		}

		if input.Quantity > currentStock {
			return Sale{}, fmt.Errorf(
				"%w: %s has only %d items available",
				ErrInsufficientStock,
				productName,
				currentStock,
			)
		}

		lineTotal := float64(input.Quantity) * input.SellingPrice
		lineCost := float64(input.Quantity) * costPrice

		var itemID string

		err = tx.QueryRow(ctx, `
			INSERT INTO sale_items(
				sale_id,
				product_id,
				product_name,
				quantity,
				selling_price_per_item,
				cost_price_per_item,
				line_total,
				line_cost
			)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8)
			RETURNING id
		`,
			saleID,
			input.ProductID,
			productName,
			input.Quantity,
			input.SellingPrice,
			costPrice,
			lineTotal,
			lineCost,
		).Scan(&itemID)
		if err != nil {
			return Sale{}, err
		}

		_, err = tx.Exec(ctx, `
			UPDATE products
			SET
				current_stock = current_stock - $2,
				updated_at = now()
			WHERE id=$1
		`,
			input.ProductID,
			input.Quantity,
		)
		if err != nil {
			return Sale{}, err
		}

		totalSale += lineTotal

		items = append(items, SaleItem{
			ID:                  itemID,
			ProductID:           input.ProductID,
			ProductName:         productName,
			Quantity:            input.Quantity,
			SellingPricePerItem: input.SellingPrice,
			CostPricePerItem:    costPrice,
			LineTotal:           lineTotal,
			LineCost:            lineCost,
		})
	}

	_, err = tx.Exec(ctx, `
		UPDATE sales
		SET total_amount=$2
		WHERE id=$1
	`, saleID, totalSale)
	if err != nil {
		return Sale{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return Sale{}, fmt.Errorf("commit sale: %w", err)
	}

	return Sale{
		ID:            saleID,
		PaymentMethod: req.PaymentMethod,
		TotalAmount:   totalSale,
		Notes:         req.Notes,
		Items:         items,
	}, nil
}
