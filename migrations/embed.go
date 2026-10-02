package migrations

import "embed"

// Files contains forward migrations only; normal startup cannot run down migrations.
//
//go:embed *.up.sql
var Files embed.FS
