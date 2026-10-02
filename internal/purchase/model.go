package purchase

import "time"

type CreateItemRequest struct {
	ProductID    string  `json:"product_id"`
	Packs        int     `json:"packs"`
	PricePerPack float64 `json:"price_per_pack"`
}

type CreateRequest struct {
	SupplierID string              `json:"supplier_id"`
	Notes      string              `json:"notes"`
	Items      []CreateItemRequest `json:"items"`
}

type PurchaseItem struct {
	ID           string  `json:"id"`
	ProductID    string  `json:"product_id"`
	ProductName  string  `json:"product_name"`
	Packs        int     `json:"packs"`
	UnitsPerPack int     `json:"units_per_pack"`
	TotalItems   int     `json:"total_items"`
	PricePerPack float64 `json:"price_per_pack"`
	PricePerItem float64 `json:"price_per_item"`
	TotalCost    float64 `json:"total_cost"`
}

type Purchase struct {
	ID           string         `json:"id"`
	SupplierID   string         `json:"supplier_id"`
	SupplierName string         `json:"supplier_name"`
	PurchaseDate time.Time      `json:"purchase_date"`
	TotalAmount  float64        `json:"total_amount"`
	Notes        string         `json:"notes"`
	Items        []PurchaseItem `json:"items"`
}
