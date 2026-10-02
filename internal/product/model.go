package product

import "time"

type Product struct {
	ID                 string    `json:"id"`
	CategoryID         string    `json:"category_id"`
	CategoryName       string    `json:"category_name"`
	Name               string    `json:"name"`
	Description        string    `json:"description"`
	UnitsPerPack       int       `json:"units_per_pack"`
	SellingPrice       float64   `json:"selling_price"`
	AverageCostPerItem float64   `json:"average_cost_per_item"`
	CurrentStock       int       `json:"current_stock"`
	LowStockLevel      int       `json:"low_stock_level"`
	StockStatus        string    `json:"stock_status,omitempty"`
	IsActive           bool      `json:"is_active"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type CreateRequest struct {
	Name          string  `json:"name"`
	CategoryID    string  `json:"category_id"`
	Description   string  `json:"description"`
	UnitsPerPack  int     `json:"units_per_pack"`
	SellingPrice  float64 `json:"selling_price"`
	LowStockLevel int     `json:"low_stock_level"`
}

type UpdateRequest struct {
	Name          string  `json:"name"`
	CategoryID    string  `json:"category_id"`
	Description   string  `json:"description"`
	UnitsPerPack  int     `json:"units_per_pack"`
	SellingPrice  float64 `json:"selling_price"`
	LowStockLevel int     `json:"low_stock_level"`
}
