package report

import (
	"net/http/httptest"
	"testing"
	"time"
)

func TestPeriodBoundaries(t *testing.T) {
	now := time.Date(2026, 10, 3, 23, 30, 0, 0, time.UTC) // Sunday in Kigali.
	for _, tc := range []struct{ period, from, to string }{
		{"today", "2026-10-04T00:00:00+02:00", "2026-10-05T00:00:00+02:00"},
		{"week", "2026-09-28T00:00:00+02:00", "2026-10-05T00:00:00+02:00"},
		{"month", "2026-10-01T00:00:00+02:00", "2026-11-01T00:00:00+02:00"},
		{"year", "2026-01-01T00:00:00+02:00", "2027-01-01T00:00:00+02:00"},
	} {
		from, to, err := resolvePeriod(tc.period, nil, nil, now)
		if err != nil || from.Format(time.RFC3339) != tc.from || to.Format(time.RFC3339) != tc.to {
			t.Errorf("%s: %s to %s, %v", tc.period, from, to, err)
		}
	}
}

func TestCustomDates(t *testing.T) {
	r := httptest.NewRequest("GET", "/?from=2026-10-03&to=2026-10-03", nil)
	from, to, err := reportDates(r)
	if err != nil || to.Sub(*from) != 24*time.Hour {
		t.Fatalf("date-only range must include entire last day: %v", err)
	}
	if _, _, err := resolvePeriod("custom", from, to, time.Now()); err != nil {
		t.Fatal(err)
	}
	if _, _, err := resolvePeriod("today", to, from, time.Now()); err == nil {
		t.Fatal("reversed range accepted")
	}
	if _, _, err := resolvePeriod("today", from, nil, time.Now()); err == nil {
		t.Fatal("incomplete range accepted")
	}
	if _, _, err := reportDates(httptest.NewRequest("GET", "/?from=not-a-date", nil)); err == nil {
		t.Fatal("invalid date accepted")
	}
}
