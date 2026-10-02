package damaged

import "time"

type Record struct {
	ID          string    `json:"id"`
	ProductID   string    `json:"product_id"`
	ProductName string    `json:"product_name"`
	Quantity    int       `json:"quantity"`
	Reason      string    `json:"reason"`
	CostPerItem float64   `json:"cost_per_item"`
	TotalLoss   float64   `json:"total_loss"`
	DamagedDate time.Time `json:"damaged_date"`
}

type CreateRequest struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
	Reason    string `json:"reason"`
}
