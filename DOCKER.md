# Development startup

With Docker Compose and the project's `.env` file, start everything with:

```powershell
docker compose up --build
```

For a new checkout, copy `.env.example` to `.env` once and set credentials.
The API and migration service share these settings, which also initialize a new
PostgreSQL volume:

```ini
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=beverages
DATABASE_USER=postgresql
DATABASE_PASSWORD=1234
PORT=8081
```

`POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` no longer need separate
entries in `.env`. Compose derives them from `DATABASE_*`. On an existing volume,
keep the database name and credentials that initialized that database; changing
environment variables does not rename databases or change stored passwords.

Startup waits for PostgreSQL health, runs `migrate` to successful completion,
starts Redis and waits for its health, then starts the API. Swagger is at
http://localhost:8081/api/docs/ and health is at http://localhost:8081/health.
The owner account is still created through the application on first use; no
default account is seeded.

```powershell
docker compose down
docker compose logs -f api
docker compose logs -f migrate
```

`down` stops/removes containers and the network but preserves named database and
Redis volumes. Normal startup never deletes volumes, resets the database, or runs
down migrations. Keep the Compose project name and directory stable so Compose
uses the existing `postgres_data` volume.

## Migrations

The migration binary embeds `migrations/*.up.sql` and uses golang-migrate's
existing `schema_migrations` version/dirty state. Only unapplied versions run.
An up-to-date database logs `database schema is already up to date` and exits
successfully. The service is a one-shot job; `Exited (0)` is expected.

Never edit a migration already applied to a database. Add a new numbered forward
migration and rebuild. Version 2 handles historical version-1 installations that
have `last_purchase_price_per_item`: it renames that column, preserving all stored
costs, stock quantities, and constraints. Fresh installations already have the new
column and version 2 makes no change. Historical cost values are carried forward;
the migration does not reconstruct past weighted averages.

If a migration fails, the service exits nonzero with the actual SQL error in its
logs. Compose blocks dependent services. Inspect `docker compose logs migrate`.
An interrupted/failed migration may be marked dirty. Inspect and repair that
specific migration state deliberately; startup never clears dirty state, forces a
version, drops tables, or resets a database. Back up important data before manual
repair. If updating a currently running stack, stop the API before migration work
(`docker compose stop api`); dependencies gate startup, not requests already being
served by an old container.

## Verification

```powershell
go test ./...
go vet ./...
docker compose build
powershell -File scripts/test-startup.ps1
```

The integration script creates a unique Compose project on port 18081 (override
with `-Port`). It checks clean startup, restart with applied migrations and saved
data, a simulated historical version-1 database, and a deliberately failing
migration that must block the API and expose its SQL error. It never uses the
development volume. Test containers are stopped afterward; test volumes are
retained and their project name is printed. Its temporary migration fixture is
only mounted into the test migration service.

Dependency conditions follow the [Docker Compose startup-order documentation](https://docs.docker.com/compose/how-tos/startup-order/).
