package sale

import "time"

type CreateItemRequest struct {
	ProductID    string  `json:"product_id"`
	Quantity     int     `json:"quantity"`
	SellingPrice float64 `json:"selling_price"`
}

type CreateRequest struct {
	PaymentMethod string              `json:"payment_method"`
	Notes         string              `json:"notes"`
	Items         []CreateItemRequest `json:"items"`
}

type SaleItem struct {
	ID                  string  `json:"id"`
	ProductID           string  `json:"product_id"`
	ProductName         string  `json:"product_name"`
	Quantity            int     `json:"quantity"`
	SellingPricePerItem float64 `json:"selling_price_per_item"`
	CostPricePerItem    float64 `json:"cost_price_per_item"`
	LineTotal           float64 `json:"line_total"`
	LineCost            float64 `json:"line_cost"`
}

type Sale struct {
	ID            string     `json:"id"`
	SaleDate      time.Time  `json:"sale_date"`
	PaymentMethod string     `json:"payment_method"`
	TotalAmount   float64    `json:"total_amount"`
	Notes         string     `json:"notes"`
	Items         []SaleItem `json:"items"`
}
