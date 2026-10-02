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
	start, end, err := resolvePeriod(period, from, to, time.Now())
	if err != nil {
		return Summary{}, err
	}
	return s.repo.Summary(ctx, start, end)
}

func (s *Service) Printable(ctx context.Context, period string, from, to *time.Time) (PrintableReport, error) {
	start, end, err := resolvePeriod(period, from, to, time.Now())
	if err != nil {
		return PrintableReport{}, err
	}
	return s.repo.Printable(ctx, start, end)
}

func resolvePeriod(period string, from, to *time.Time, now time.Time) (time.Time, time.Time, error) {
	zone, err := time.LoadLocation("Africa/Kigali")
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	now = now.In(zone)
	if from != nil || to != nil {
		if from == nil || to == nil || !from.Before(*to) {
			return time.Time{}, time.Time{}, ErrInvalidPeriod
		}
		return from.In(zone), to.In(zone), nil
	}
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, zone)
	var end time.Time
	switch period {
	case "", "today":
		end = start.AddDate(0, 0, 1)
	case "week":
		start = start.AddDate(0, 0, -((int(now.Weekday()) + 6) % 7))
		end = start.AddDate(0, 0, 7)
	case "month":
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, zone)
		end = start.AddDate(0, 1, 0)
	case "year":
		start = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, zone)
		end = start.AddDate(1, 0, 0)
	default:
		return time.Time{}, time.Time{}, ErrInvalidPeriod
	}
	return start, end, nil
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
