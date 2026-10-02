package config

import (
	"net/url"
	"testing"
)

func TestDatabaseURLPreservesCredentials(t *testing.T) {
	cfg := Config{DatabaseHost: "postgres", DatabasePort: "5432", DatabaseName: "beverages", DatabaseUser: "shop@owner", DatabasePassword: "p@ss:/?#% word"}
	u, err := url.Parse(cfg.DatabaseURL())
	if err != nil {
		t.Fatal(err)
	}
	password, _ := u.User.Password()
	if u.User.Username() != cfg.DatabaseUser || password != cfg.DatabasePassword || u.Host != "postgres:5432" || u.Path != "/beverages" {
		t.Fatal("database URL did not preserve connection settings")
	}
}
