package purchase

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
	ErrSupplierNotFound = errors.New("supplier not found")
	ErrProductNotFound  = errors.New("product not found")
	ErrNotFound         = errors.New("purchase not found")
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
	supplierID string,
	limit, offset int,
) ([]Purchase, error) {
	query := `
		SELECT
			p.id,
			COALESCE(p.supplier_id::text, ''),
			COALESCE(s.name, ''),
			p.purchase_date,
			p.total_amount,
			COALESCE(p.notes, ''),
			COALESCE(json_agg(json_build_object(
				'id', pi.id,
				'product_id', pi.product_id,
				'product_name', pr.name,
				'packs', pi.packs,
				'units_per_pack', pi.units_per_pack,
				'total_items', pi.total_items,
				'price_per_pack', pi.price_per_pack,
				'price_per_item', pi.price_per_item,
				'total_cost', pi.total_cost
			) ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL), '[]'::json)
		FROM purchases p
		LEFT JOIN suppliers s ON s.id = p.supplier_id
		LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
		LEFT JOIN products pr ON pr.id = pi.product_id
		WHERE ($1::timestamptz IS NULL OR p.purchase_date >= $1)
		  AND ($2::timestamptz IS NULL OR p.purchase_date < $2)
		  AND (NULLIF($3::text, '') IS NULL OR p.supplier_id = NULLIF($3::text, '')::uuid)
		GROUP BY p.id, s.name
		ORDER BY p.purchase_date DESC, p.id DESC
		LIMIT $4 OFFSET $5
	`

	rows, err := r.db.Query(ctx, query, from, to, supplierID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Purchase, 0)
	for rows.Next() {
		var item Purchase
		var rawItems []byte
		if err := rows.Scan(
			&item.ID,
			&item.SupplierID,
			&item.SupplierName,
			&item.PurchaseDate,
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

func (r *Repository) GetByID(ctx context.Context, id string) (Purchase, error) {
	query := `
		SELECT
			p.id,
			COALESCE(p.supplier_id::text, ''),
			COALESCE(s.name, ''),
			p.purchase_date,
			p.total_amount,
			COALESCE(p.notes, ''),
			COALESCE(json_agg(json_build_object(
				'id', pi.id,
				'product_id', pi.product_id,
				'product_name', pr.name,
				'packs', pi.packs,
				'units_per_pack', pi.units_per_pack,
				'total_items', pi.total_items,
				'price_per_pack', pi.price_per_pack,
				'price_per_item', pi.price_per_item,
				'total_cost', pi.total_cost
			) ORDER BY pi.id) FILTER (WHERE pi.id IS NOT NULL), '[]'::json)
		FROM purchases p
		LEFT JOIN suppliers s ON s.id = p.supplier_id
		LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
		LEFT JOIN products pr ON pr.id = pi.product_id
		WHERE p.id = $1
		GROUP BY p.id, s.name
	`

	var item Purchase
	var rawItems []byte
	err := r.db.QueryRow(ctx, query, id).Scan(
		&item.ID,
		&item.SupplierID,
		&item.SupplierName,
		&item.PurchaseDate,
		&item.TotalAmount,
		&item.Notes,
		&rawItems,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Purchase{}, ErrNotFound
	}
	if err != nil {
		return Purchase{}, err
	}
	if err := json.Unmarshal(rawItems, &item.Items); err != nil {
		return Purchase{}, err
	}
	return item, nil
}

func (r *Repository) Create(
	ctx context.Context,
	req CreateRequest,
) (Purchase, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Purchase{}, err
	}

	defer func() {
		_ = tx.Rollback(ctx)
	}()

	var supplierName string

	err = tx.QueryRow(ctx, `
		SELECT name
		FROM suppliers
		WHERE id=$1
	`, req.SupplierID).Scan(&supplierName)

	if errors.Is(err, pgx.ErrNoRows) {
		return Purchase{}, ErrSupplierNotFound
	}

	if err != nil {
		return Purchase{}, err
	}

	var purchaseID string

	err = tx.QueryRow(ctx, `
		INSERT INTO purchases(
			supplier_id,
			total_amount,
			notes
		)
		VALUES($1,0,$2)
		RETURNING id
	`,
		req.SupplierID,
		req.Notes,
	).Scan(&purchaseID)
	if err != nil {
		return Purchase{}, err
	}

	totalPurchase := 0.0
	items := make([]PurchaseItem, 0, len(req.Items))

	for _, input := range req.Items {
		var productName string
		var unitsPerPack int

		err = tx.QueryRow(ctx, `
			SELECT name, units_per_pack
			FROM products
			WHERE id=$1
			  AND is_active=TRUE
			FOR UPDATE
		`, input.ProductID).Scan(
			&productName,
			&unitsPerPack,
		)

		if errors.Is(err, pgx.ErrNoRows) {
			return Purchase{}, ErrProductNotFound
		}

		if err != nil {
			return Purchase{}, err
		}

		totalItems := input.Packs * unitsPerPack
		pricePerItem := input.PricePerPack / float64(unitsPerPack)
		totalCost := input.PricePerPack * float64(input.Packs)

		var itemID string

		err = tx.QueryRow(ctx, `
			INSERT INTO purchase_items(
				purchase_id,
				product_id,
				packs,
				units_per_pack,
				total_items,
				price_per_pack,
				price_per_item,
				total_cost
			)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8)
			RETURNING id
		`,
			purchaseID,
			input.ProductID,
			input.Packs,
			unitsPerPack,
			totalItems,
			input.PricePerPack,
			pricePerItem,
			totalCost,
		).Scan(&itemID)
		if err != nil {
			return Purchase{}, err
		}

		var currentStock int
		var currentAverageCost float64
		err = tx.QueryRow(ctx, `
			SELECT current_stock, average_cost_per_item
			FROM products
			WHERE id = $1
			FOR UPDATE
		`, input.ProductID).Scan(&currentStock, &currentAverageCost)
		if err != nil {
			return Purchase{}, err
		}

		oldStockValue := float64(currentStock) * currentAverageCost
		newPurchaseValue := float64(totalItems) * pricePerItem
		newAverageCost := (oldStockValue + newPurchaseValue) / float64(currentStock+totalItems)

		_, err = tx.Exec(ctx, `
			UPDATE products
			SET
				current_stock = current_stock + $2,
				average_cost_per_item = $3,
				updated_at = now()
			WHERE id=$1
		`,
			input.ProductID,
			totalItems,
			newAverageCost,
		)
		if err != nil {
			return Purchase{}, err
		}

		totalPurchase += totalCost

		items = append(items, PurchaseItem{
			ID:           itemID,
			ProductID:    input.ProductID,
			ProductName:  productName,
			Packs:        input.Packs,
			UnitsPerPack: unitsPerPack,
			TotalItems:   totalItems,
			PricePerPack: input.PricePerPack,
			PricePerItem: pricePerItem,
			TotalCost:    totalCost,
		})
	}

	_, err = tx.Exec(ctx, `
		UPDATE purchases
		SET total_amount=$2
		WHERE id=$1
	`, purchaseID, totalPurchase)
	if err != nil {
		return Purchase{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return Purchase{}, fmt.Errorf("commit purchase: %w", err)
	}

	return Purchase{
		ID:           purchaseID,
		SupplierID:   req.SupplierID,
		SupplierName: supplierName,
		TotalAmount:  totalPurchase,
		Notes:        req.Notes,
		Items:        items,
	}, nil
}
