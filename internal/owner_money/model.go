package owner_money

import "time"

type Entry struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Amount    float64   `json:"amount"`
	Notes     string    `json:"notes"`
	EntryDate time.Time `json:"entry_date"`
}

type CreateRequest struct {
	Type   string  `json:"type"`
	Amount float64 `json:"amount"`
	Notes  string  `json:"notes"`
}
