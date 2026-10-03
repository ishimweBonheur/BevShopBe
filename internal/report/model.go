package report

import "time"

type Summary struct {
	DamagedItems    int     `json:"damaged_items"`
	OutOfStockCount int     `json:"out_of_stock_count"`
	Cash            float64 `json:"cash"`
	MobileMoney     float64 `json:"mobile_money"`
	Bank            float64 `json:"bank"`
	SalesRevenue    float64 `json:"sales_revenue"`
	Purchases       float64 `json:"purchases"`
	CostOfGoods     float64 `json:"cost_of_items_sold"`
	Expenses        float64 `json:"expenses"`
	DamagedLoss     float64 `json:"damaged_loss"`
	ProfitLoss      float64 `json:"profit_loss"`
	ItemsSold       int     `json:"items_sold"`
	ItemsPurchased  int     `json:"items_purchased"`
	CurrentStock    int     `json:"current_stock"`
	LowStockCount   int     `json:"low_stock_count"`
}

type Dashboard struct {
	Summary        Summary          `json:"summary"`
	InventoryValue float64          `json:"inventory_value"`
	ProfitMargin   float64          `json:"profit_margin"`
	TopProducts    []ProductSummary `json:"top_products"`
}

type ProductSummary struct {
	ProductID   string  `json:"product_id"`
	ProductName string  `json:"product_name"`
	Quantity    int     `json:"quantity"`
	Revenue     float64 `json:"revenue"`
}

type HistoryItem struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"`
	Date        time.Time `json:"date"`
	Description string    `json:"description"`
	Amount      float64   `json:"amount"`
	ReferenceID string    `json:"reference_id,omitempty"`
	Category    string    `json:"category"`
	Quantity    *int      `json:"quantity"`
	Details     string    `json:"details"`
}

type Period struct {
	From time.Time `json:"from"`
	To   time.Time `json:"to"`
}

type MonthlySummary struct {
	Month   string  `json:"month"`
	Summary Summary `json:"summary"`
}

type PrintableReport struct {
	Monthly     []MonthlySummary `json:"monthly"`
	Title       string           `json:"title"`
	Period      Period           `json:"period"`
	GeneratedAt time.Time        `json:"generated_at"`
	Summary     Summary          `json:"summary"`
	History     []HistoryItem    `json:"history"`
}
