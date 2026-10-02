package main

import (
	"bevshop/internal/config"
	"bevshop/migrations"
	"errors"
	"flag"
	"io/fs"
	"log"
	"os"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

func main() {
	path := flag.String("path", "", "optional directory of migration files (defaults to embedded migrations)")
	flag.Parse()
	var files fs.FS = migrations.Files
	if *path != "" {
		files = os.DirFS(*path)
	}
	source, err := iofs.New(files, ".")
	if err != nil {
		log.Fatalf("load migrations: %v", err)
	}
	runner, err := migrate.NewWithSourceInstance("iofs", source, config.Load().DatabaseURL())
	if err != nil {
		log.Fatalf("connect migration runner: %v", err)
	}
	defer runner.Close()
	log.Print("applying pending database migrations")
	if err := runner.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		log.Fatalf("database migration failed: %v", err)
	} else if errors.Is(err, migrate.ErrNoChange) {
		log.Print("database schema is already up to date")
	}
	version, dirty, err := runner.Version()
	if err != nil {
		log.Fatalf("read migration version: %v", err)
	}
	log.Printf("database migrations complete: version=%d dirty=%t", version, dirty)
}
