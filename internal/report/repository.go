package report

import (
	"context"
	"github.com/jackc/pgx/v5"
	"math"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db interface {
		Query(context.Context, string, ...any) (pgx.Rows, error)
		QueryRow(context.Context, string, ...any) pgx.Row
	}
	pool *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db, pool: db}
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
			), 0),
 COALESCE((SELECT SUM(quantity) FROM damaged_items WHERE damaged_date >= $1 AND damaged_date < $2), 0),
 (SELECT COUNT(*) FROM products WHERE is_active AND current_stock = 0),
 COALESCE((SELECT SUM(total_amount) FROM sales WHERE sale_date >= $1 AND sale_date < $2 AND payment_method='cash'), 0),
 COALESCE((SELECT SUM(total_amount) FROM sales WHERE sale_date >= $1 AND sale_date < $2 AND payment_method='mobile_money'), 0),
 COALESCE((SELECT SUM(total_amount) FROM sales WHERE sale_date >= $1 AND sale_date < $2 AND payment_method='bank'), 0)
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
		&result.DamagedItems, &result.OutOfStockCount, &result.Cash, &result.MobileMoney, &result.Bank,
	)

	if err != nil {
		return Summary{}, err
	}

	result.ProfitLoss = math.Round((result.SalesRevenue-result.CostOfGoods-result.Expenses-result.DamagedLoss)*100) / 100

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
	return r.history(ctx, from, to, &limit)
}

func (r *Repository) history(ctx context.Context, from, to time.Time, limit *int) ([]HistoryItem, error) {
	rows, err := r.db.Query(ctx, historySQL, from, to, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]HistoryItem, 0)
	for rows.Next() {
		var item HistoryItem
		if err := rows.Scan(&item.ID, &item.Type, &item.Date, &item.Description, &item.Amount, &item.ReferenceID, &item.Category, &item.Quantity, &item.Details); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// Printable reads totals and all activity in one consistent, read-only snapshot.
func (r *Repository) Printable(ctx context.Context, from, to time.Time) (PrintableReport, error) {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return PrintableReport{}, err
	}
	defer tx.Rollback(ctx)
	snapshot := &Repository{db: tx}
	summary, err := snapshot.Summary(ctx, from, to)
	if err != nil {
		return PrintableReport{}, err
	}
	history, err := snapshot.history(ctx, from, to, nil)
	if err != nil {
		return PrintableReport{}, err
	}
	monthly := make([]MonthlySummary, 0)
	for start := time.Date(from.Year(), from.Month(), 1, 0, 0, 0, 0, from.Location()); start.Before(to); start = start.AddDate(0, 1, 0) {
		lower, upper := start, start.AddDate(0, 1, 0)
		if lower.Before(from) {
			lower = from
		}
		if upper.After(to) {
			upper = to
		}
		totals, err := snapshot.Summary(ctx, lower, upper)
		if err != nil {
			return PrintableReport{}, err
		}
		monthly = append(monthly, MonthlySummary{Month: start.Format("2006-01"), Summary: totals})
	}
	if err := tx.Commit(ctx); err != nil {
		return PrintableReport{}, err
	}
	return PrintableReport{Title: "BevShop Business Report", Period: Period{From: from, To: to}, GeneratedAt: time.Now(), Summary: summary, History: history, Monthly: monthly}, nil
}

const historySQL = `
 WITH combined AS (
 SELECT si.id, 'sale'::text AS type, s.sale_date AS event_time,
   si.product_name AS description, si.line_total AS amount, s.id::text AS reference_id,
   c.name AS category, si.quantity,
   concat('Payment: ', s.payment_method, '; unit price: ', si.selling_price_per_item, '; cost: ', si.cost_price_per_item, '; ', COALESCE(s.notes, '')) AS details
 FROM sale_items si JOIN sales s ON s.id=si.sale_id
 JOIN products p ON p.id=si.product_id JOIN categories c ON c.id=p.category_id
 WHERE s.sale_date >= $1 AND s.sale_date < $2
 UNION ALL
 SELECT pi.id, 'purchase', pu.purchase_date, p.name, pi.total_cost, pu.id::text,
   c.name, pi.total_items,
   concat('Supplier: ', COALESCE(s.name, ''), '; packs: ', pi.packs, '; units/pack: ', pi.units_per_pack, '; price/pack: ', pi.price_per_pack, '; ', COALESCE(pu.notes, ''))
 FROM purchase_items pi JOIN purchases pu ON pu.id=pi.purchase_id
 JOIN products p ON p.id=pi.product_id JOIN categories c ON c.id=p.category_id
 LEFT JOIN suppliers s ON s.id=pu.supplier_id
 WHERE pu.purchase_date >= $1 AND pu.purchase_date < $2
 UNION ALL
 SELECT id, 'expense', expense_date, name, amount, id::text,
   COALESCE(category, ''), NULL::integer, COALESCE(description, '')
 FROM expenses WHERE expense_date >= $1 AND expense_date < $2
 UNION ALL
 SELECT d.id, 'damage', d.damaged_date, p.name, d.total_loss, d.id::text,
   c.name, d.quantity, concat(COALESCE(d.reason, ''), '; cost/item: ', d.cost_per_item)
 FROM damaged_items d JOIN products p ON p.id=d.product_id JOIN categories c ON c.id=p.category_id
 WHERE d.damaged_date >= $1 AND d.damaged_date < $2
 UNION ALL
 SELECT id, entry_type, entry_date,
   CASE entry_type WHEN 'money_added' THEN 'Money Added' ELSE 'Money Taken' END,
   amount, id::text, '', NULL::integer, COALESCE(notes, '')
 FROM owner_money WHERE entry_date >= $1 AND entry_date < $2
 )
 SELECT id, type, event_time, description, amount, reference_id, category, quantity, details
 FROM combined ORDER BY event_time DESC, type, id DESC LIMIT $3
`
