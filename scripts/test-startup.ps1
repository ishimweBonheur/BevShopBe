param([int]$Port = 18081)
$ErrorActionPreference = 'Stop'
$project = 'bevshop-startup-test-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
$root = Split-Path $PSScriptRoot -Parent
$fixtures = Join-Path ([IO.Path]::GetTempPath()) $project
New-Item -ItemType Directory -Path $fixtures | Out-Null
$previousPort = $env:PORT
$env:PORT = "$Port"
$compose = @('compose', '-p', $project, '-f', (Join-Path $root 'docker-compose.yml'))
function Invoke-Compose {
    & docker @compose @args
    if ($LASTEXITCODE -ne 0) { throw "Compose failed: $args" }
}
function Invoke-SQL([string]$sql) {
    $result = $sql | & docker @compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -At -U $POSTGRES_USER -d $POSTGRES_DB'
    if ($LASTEXITCODE -ne 0) { throw 'Test SQL failed' }
    return ($result -join "`n").Trim()
}
try {
    Invoke-Compose up -d --no-build --wait
    if ((Invoke-SQL 'SELECT version FROM schema_migrations WHERE NOT dirty') -ne '2') { throw 'Fresh migrations failed' }
    Invoke-SQL "INSERT INTO categories (id,name) VALUES ('11111111-1111-4111-8111-111111111111','Startup test'); INSERT INTO products (category_id,name,units_per_pack,selling_price,average_cost_per_item,current_stock) VALUES ('11111111-1111-4111-8111-111111111111','Preserved product',24,700,533.33,338);" | Out-Null
    Invoke-Compose down
    Invoke-Compose up -d --no-build --wait
    if ((Invoke-SQL "SELECT average_cost_per_item || ':' || current_stock FROM products WHERE name='Preserved product'") -ne '533.33:338') { throw 'Repeat startup changed data' }
    Invoke-Compose logs migrate
    Write-Host 'PASS: clean startup and repeat startup preserve data.'

    # Simulate the historical version-1 schema only inside this isolated test project.
    Invoke-Compose stop api
    Invoke-SQL 'ALTER TABLE products RENAME COLUMN average_cost_per_item TO last_purchase_price_per_item; UPDATE schema_migrations SET version=1;' | Out-Null
    Invoke-Compose run --rm migrate
    if ((Invoke-SQL "SELECT average_cost_per_item || ':' || current_stock FROM products WHERE name='Preserved product'") -ne '533.33:338') { throw 'Legacy migration changed values' }
    Write-Host 'PASS: historical version-1 schema upgrades without losing cost or stock.'
    Invoke-Compose down

    Copy-Item (Join-Path $root 'migrations/*.up.sql') $fixtures
    [IO.File]::WriteAllText((Join-Path $fixtures '000003_intentional_failure.up.sql'), 'THIS IS AN INTENTIONAL SQL FAILURE;')
    $mount = $fixtures.Replace('\','/')
    $override = Join-Path $fixtures 'failure.yml'
    [IO.File]::WriteAllText($override, "services:`n  migrate:`n    command: ['./bevshop-migrate', '-path', '/test-migrations']`n    volumes:`n      - '${mount}:/test-migrations:ro'`n")
    & docker @compose -f $override up -d --no-build
    if ($LASTEXITCODE -eq 0) { throw 'Failed migration incorrectly allowed startup' }
    $running = & docker @compose ps --status running --services
    if ($running -contains 'api') { throw 'API is running after migration failure' }
    $logs = (& docker @compose logs --no-color migrate 2>&1 | Out-String)
    if ($logs -notmatch 'syntax error') { throw 'Real migration error missing from logs' }
    Write-Host $logs
    Write-Host 'PASS: invalid migration exits nonzero, logs the SQL error, and blocks API startup.'
} finally {
    & docker @compose down
    $env:PORT = $previousPort
    if (Test-Path -LiteralPath $fixtures) {
        Remove-Item -LiteralPath $fixtures -Recurse -Force
    }
    Write-Host "Isolated project: $project. Its test volumes were retained; the development volumes were never used."
}
