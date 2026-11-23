param(
  [Parameter(Mandatory)][string]$OutputDirectory,
  [Parameter(Mandatory)][string]$PgBin
)
$ErrorActionPreference = 'Stop'
$ref = 'bgtztcfbkcrvcipxbfti'
if (-not $env:PGUSER) { throw 'Inject the approved staging PGUSER and ephemeral authentication locally before export.' }
if ($env:PGPASSWORD) { throw 'Use a temporary local PGPASSFILE or interactive authentication, not PGPASSWORD.' }

$target = [IO.Path]::GetFullPath($OutputDirectory)
$gitRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ($target.Equals($gitRoot, [StringComparison]::OrdinalIgnoreCase) -or
    $target.StartsWith($gitRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Choose an output directory outside the repository.'
}
if (Test-Path -LiteralPath $target) { throw 'Choose a new private output directory.' }
$dump = Join-Path $PgBin 'pg_dump.exe'
$psql = Join-Path $PgBin 'psql.exe'
foreach ($binary in @($dump, $psql)) {
  $version = & $binary --version
  if ($LASTEXITCODE -ne 0 -or $version -notmatch '\b17\.') { throw 'Use PostgreSQL 17 client binaries.' }
}

# Override endpoint selection. Refuse inherited service/options so they cannot redirect or inject startup SQL.
foreach ($name in @('PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGOPTIONS','PGREQUIREAUTH','PGSSLNEGOTIATION')) {
  if ([Environment]::GetEnvironmentVariable($name)) { throw "Clear $name from this dedicated export shell." }
}
$env:PGSSLMODE = 'verify-full'
$env:PGOPTIONS = '-c default_transaction_read_only=on -c search_path=pg_catalog'
$connection = @('--host', "db.$ref.supabase.co", '--port', '5432', '--dbname', 'postgres')
$manifestSql = Join-Path $PSScriptRoot 'issue-140-staging-manifest.sql'
function Read-Manifest {
  $result = & $psql @connection -X -qAt -v ON_ERROR_STOP=1 -f $manifestSql
  if ($LASTEXITCODE -ne 0) { throw 'Staging catalog export failed. No snapshot accepted.' }
  return $result -join "`n"
}

try {
  $before = Read-Manifest
  $parsed = $before | ConvertFrom-Json
  $gate = $parsed.checkpoint
  if ($parsed.database_version -notmatch '^17\.' -or -not $gate.booking_12 -or $gate.booking_13 -or
      $gate.training_guard -or $gate.training_assignments -or $gate.quote_guard -or $gate.offer_table) {
    throw 'Staging ABI differs from checkpoint 76ed06e. Stop before dump.'
  }
  if ($parsed.foreign_servers -gt 0) { throw 'Foreign server mappings may contain credentials. Review export scope before dumping.' }
  New-Item -ItemType Directory -Path $target | Out-Null
  $schema = Join-Path $target 'staging-schema.sql'
  & $dump @connection --schema-only --no-owner --no-privileges --no-comments --no-security-labels --no-subscriptions --file $schema
  if ($LASTEXITCODE -ne 0) { throw 'Schema dump failed. Treat any output as incomplete.' }
  $after = Read-Manifest
  if ($after -cne $before) { throw 'Catalog changed across export. Do not use this dump.' }
  [IO.File]::WriteAllText((Join-Path $target 'staging-catalog.json'), $before)
  [ordered]@{
    staging_ref = $ref
    checkpoint = '76ed06e / 36e7cce'
    exported_utc = [DateTime]::UtcNow.ToString('o')
    schema_sha256 = (Get-FileHash -LiteralPath $schema -Algorithm SHA256).Hash
    catalog_sha256 = (Get-FileHash -LiteralPath (Join-Path $target 'staging-catalog.json') -Algorithm SHA256).Hash
    review = 'Unreviewed. Inspect schema-only DDL for embedded secrets, confirm PostgREST settings and restore ACL/owners before use.'
  } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $target 'staging-export.json')
} finally {
  Remove-Item Env:PGOPTIONS -ErrorAction SilentlyContinue
}
