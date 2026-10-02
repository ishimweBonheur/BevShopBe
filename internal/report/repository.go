package report

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Summary(
	ctx context.Context,
	from time.Time,
	to time.Time,
) (Summary, error) {
	var result Summary

	err := r.db.QueryRow(ctx, `
		SELECT
			COALESCE((
				SELECT SUM(total_amount)
				FROM sales
				WHERE sale_date >= $1
				  AND sale_date < $2
			), 0),

			COALESCE((
				SELECT SUM(total_amount)
				FROM purchases
				WHERE purchase_date >= $1
				  AND purchase_date < $2
			), 0),

			COALESCE((
				SELECT SUM(line_cost)
				FROM sale_items si
				JOIN sales s ON s.id = si.sale_id
				WHERE s.sale_date >= $1
				  AND s.sale_date < $2
			), 0),

			COALESCE((
				SELECT SUM(amount)
				FROM expenses
				WHERE expense_date >= $1
				  AND expense_date < $2
			), 0),

			COALESCE((
				SELECT SUM(total_loss)
				FROM damaged_items
				WHERE damaged_date >= $1
				  AND damaged_date < $2
			), 0),

			COALESCE((
				SELECT SUM(quantity)
				FROM sale_items si
				JOIN sales s ON s.id = si.sale_id
				WHERE s.sale_date >= $1
				  AND s.sale_date < $2
			), 0),

			COALESCE((
				SELECT SUM(total_items)
				FROM purchase_items pi
				JOIN purchases p ON p.id = pi.purchase_id
				WHERE p.purchase_date >= $1
				  AND p.purchase_date < $2
			), 0),

			COALESCE((
				SELECT SUM(current_stock)
				FROM products
				WHERE is_active = TRUE
			), 0),

			COALESCE((
				SELECT COUNT(*)
				FROM products
				WHERE is_active = TRUE
				  AND current_stock <= low_stock_level
			), 0)
	`, from, to).Scan(
		&result.SalesRevenue,
		&result.Purchases,
		&result.CostOfGoods,
		&result.Expenses,
		&result.DamagedLoss,
		&result.ItemsSold,
		&result.ItemsPurchased,
		&result.CurrentStock,
		&result.LowStockCount,
	)

	if err != nil {
		return Summary{}, err
	}

	result.ProfitLoss = result.SalesRevenue - result.CostOfGoods - result.Expenses - result.DamagedLoss

	return result, nil
}

func (r *Repository) InventoryValue(ctx context.Context) (float64, error) {
	var value float64
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(average_cost_per_item * current_stock), 0)
		FROM products
		WHERE is_active = TRUE
	`).Scan(&value)
	return value, err
}

func (r *Repository) TopProducts(ctx context.Context, from, to time.Time) ([]ProductSummary, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			p.id,
			p.name,
			COALESCE(SUM(si.quantity), 0),
			COALESCE(SUM(si.line_total), 0)
		FROM sale_items si
		JOIN sales s ON s.id = si.sale_id
		JOIN products p ON p.id = si.product_id
		WHERE s.sale_date >= $1
		  AND s.sale_date < $2
		GROUP BY p.id, p.name
		ORDER BY SUM(si.line_total) DESC, SUM(si.quantity) DESC
		LIMIT 5
	`, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ProductSummary, 0)
	for rows.Next() {
		var item ProductSummary
		if err := rows.Scan(&item.ProductID, &item.ProductName, &item.Quantity, &item.Revenue); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) History(ctx context.Context, from, to time.Time, limit int) ([]HistoryItem, error) {
	rows, err := r.db.Query(ctx, `
		WITH combined AS (
			SELECT id, 'sale'::text AS type, sale_date AS event_time, notes AS description, total_amount AS amount, id::text AS reference_id
			FROM sales
			WHERE sale_date >= $1 AND sale_date < $2
			UNION ALL
			SELECT id, 'purchase'::text AS type, purchase_date AS event_time, COALESCE(notes, 'Purchase') AS description, total_amount AS amount, id::text AS reference_id
			FROM purchases
			WHERE purchase_date >= $1 AND purchase_date < $2
			UNION ALL
			SELECT id, 'expense'::text AS type, expense_date AS event_time, name AS description, amount, id::text AS reference_id
			FROM expenses
			WHERE expense_date >= $1 AND expense_date < $2
			UNION ALL
			SELECT id, 'damage'::text AS type, damaged_date AS event_time, COALESCE(reason, 'Damaged item') AS description, total_loss AS amount, id::text AS reference_id
			FROM damaged_items
			WHERE damaged_date >= $1 AND damaged_date < $2
		)
		SELECT id, type, event_time, description, amount, reference_id
		FROM combined
		ORDER BY event_time DESC, id DESC
		LIMIT $3
	`, from, to, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]HistoryItem, 0)
	for rows.Next() {
		var item HistoryItem
		if err := rows.Scan(&item.ID, &item.Type, &item.Date, &item.Description, &item.Amount, &item.ReferenceID); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
