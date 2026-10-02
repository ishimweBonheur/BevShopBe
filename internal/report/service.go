package report

import (
	"context"
	"errors"
	"time"
)

var ErrInvalidPeriod = errors.New("invalid report period")

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Summary(ctx context.Context, period string, from, to *time.Time) (Summary, error) {
	if from != nil || to != nil {
		if from == nil {
			from = &time.Time{}
		}
		if to == nil {
			now := time.Now()
			to = &now
		}
		return s.repo.Summary(ctx, *from, *to)
	}

	now := time.Now()

	var start time.Time
	var end time.Time

	switch period {
	case "", "today":
		start = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		end = start.AddDate(0, 0, 1)
	case "week":
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		start = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).AddDate(0, 0, -(weekday-1))
		end = start.AddDate(0, 0, 7)
	case "month":
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		end = start.AddDate(0, 1, 0)
	case "year":
		start = time.Date(now.Year(), time.January, 1, 0, 0, 0, 0, now.Location())
		end = start.AddDate(1, 0, 0)
	default:
		return Summary{}, ErrInvalidPeriod
	}

	return s.repo.Summary(ctx, start, end)
}

func (s *Service) Dashboard(ctx context.Context, from, to *time.Time) (Dashboard, error) {
	if from == nil || to == nil {
		now := time.Now()
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		end := start.AddDate(0, 1, 0)
		from = &start
		to = &end
	}

	summary, err := s.repo.Summary(ctx, *from, *to)
	if err != nil {
		return Dashboard{}, err
	}

	inventoryValue, err := s.repo.InventoryValue(ctx)
	if err != nil {
		return Dashboard{}, err
	}

	topProducts, err := s.repo.TopProducts(ctx, *from, *to)
	if err != nil {
		return Dashboard{}, err
	}

	profitMargin := 0.0
	if summary.SalesRevenue > 0 {
		profitMargin = ((summary.SalesRevenue - summary.CostOfGoods - summary.Expenses - summary.DamagedLoss) / summary.SalesRevenue) * 100
	}

	return Dashboard{
		Summary:        summary,
		InventoryValue: inventoryValue,
		ProfitMargin:   profitMargin,
		TopProducts:    topProducts,
	}, nil
}

func (s *Service) History(ctx context.Context, from, to *time.Time, limit int) ([]HistoryItem, error) {
	if limit <= 0 {
		limit = 50
	}
	if from == nil {
		now := time.Now()
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		from = &start
	}
	if to == nil {
		now := time.Now()
		to = &now
	}
	return s.repo.History(ctx, *from, *to, limit)
}
