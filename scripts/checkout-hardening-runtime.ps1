[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$pgBin = Join-Path $repo '.tools\postgresql-test\runtime\pgsql\bin'
$migrationDir = Join-Path $repo 'supabase\migrations'
$drizzleDir = Join-Path $repo 'drizzle\migrations'
$port = 55448
$runRoot = Join-Path ([IO.Path]::GetTempPath()) ('baturaden25-checkout-hardening-' + [guid]::NewGuid().ToString('N'))
$cluster = Join-Path $runRoot 'cluster'
$dbName = 'checkout_hardening_test'
$serverOut = Join-Path $runRoot 'postgres.out.log'
$serverErr = Join-Path $runRoot 'postgres.err.log'
$concurrencyOutA = Join-Path $runRoot 'concurrency-a.log'
$concurrencyErrA = Join-Path $runRoot 'concurrency-a.err.log'
$concurrencyOutB = Join-Path $runRoot 'concurrency-b.log'
$concurrencyErrB = Join-Path $runRoot 'concurrency-b.err.log'

$psql = Join-Path $pgBin 'psql.exe'
$initdb = Join-Path $pgBin 'initdb.exe'
$createdb = Join-Path $pgBin 'createdb.exe'
$postgres = Join-Path $pgBin 'postgres.exe'
$pgctl = Join-Path $pgBin 'pg_ctl.exe'
$pgisready = Join-Path $pgBin 'pg_isready.exe'

function Invoke-Psql([string]$file) {
  & $psql -X -h 127.0.0.1 -p $port -U postgres -d $dbName -v ON_ERROR_STOP=1 -f $file
  if ($LASTEXITCODE -ne 0) { throw "psql failed: $file" }
}

New-Item -ItemType Directory -Path $runRoot -Force | Out-Null
& $initdb -D $cluster -U postgres --auth-local=trust --auth-host=trust --no-locale | Out-Null
$server = Start-Process -FilePath $postgres -ArgumentList @('-D', $cluster, '-h', '127.0.0.1', '-p', $port) -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr -WindowStyle Hidden -PassThru

try {
  $ready = $false
  for ($attempt = 1; $attempt -le 60; $attempt++) {
    & $pgisready -h 127.0.0.1 -p $port -U postgres -d postgres | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw 'isolated PostgreSQL did not become ready' }

  & $createdb -h 127.0.0.1 -p $port -U postgres $dbName
  if ($LASTEXITCODE -ne 0) { throw 'createdb failed' }

  Invoke-Psql (Join-Path $repo '.tools\postgresql-test\bootstrap-supabase-stubs.sql')

  Get-ChildItem -LiteralPath $drizzleDir -Filter '*.sql' |
    Where-Object { $_.Name -match '^000[0-5]_' } |
    Sort-Object Name |
    ForEach-Object { Invoke-Psql $_.FullName }

  $seedBoundary = '20261006000002_room_type_pricing_catalog.sql'
  $financeBoundary = '20261015000000_finance_foundation.sql'
  $baseMigrations = Get-ChildItem -LiteralPath $migrationDir -Filter '*.sql' |
    Where-Object {
      $_.Name -lt $financeBoundary -and
      $_.Name -ne '20261006000010_correct_p4_prices.sql'
    } |
    Sort-Object Name

  $baseMigrations |
    Where-Object { $_.Name -le $seedBoundary } |
    ForEach-Object { Invoke-Psql $_.FullName }

  Invoke-Psql (Join-Path $repo '.tools\postgresql-test\seed-master-data.sql')
  Invoke-Psql (Join-Path $repo '.tools\postgresql-test\seed-receptionists.sql')

  $baseMigrations |
    Where-Object { $_.Name -gt $seedBoundary } |
    ForEach-Object { Invoke-Psql $_.FullName }

  Invoke-Psql (Join-Path $migrationDir '20261015000000_finance_foundation.sql')
  Invoke-Psql (Join-Path $migrationDir '20261015000001_finance_150_booking_compatibility.sql')
  Invoke-Psql (Join-Path $migrationDir '20261015000002_finance_150_supervisor_alignment.sql')
  Invoke-Psql (Join-Path $migrationDir '20261015000003_booking_reference_read_privileges.sql')
  Invoke-Psql (Join-Path $migrationDir '20261018000000_finance_training_enforcement.sql')
  Invoke-Psql (Join-Path $migrationDir '20261019000000_owner_final_numbering.sql')
  Invoke-Psql (Join-Path $migrationDir '20261019000001_harden_checkout_payment_settlement.sql')
  Invoke-Psql (Join-Path $repo 'scripts\checkout-hardening-sql-runtime-tests.sql')

  $baseArgs = @('-X', '-h', '127.0.0.1', '-p', $port, '-U', 'postgres', '-d', $dbName, '-f')
  $procA = Start-Process -FilePath $psql -ArgumentList ($baseArgs + (Join-Path $repo 'scripts\checkout-hardening-concurrency-a.sql')) -RedirectStandardOutput $concurrencyOutA -RedirectStandardError $concurrencyErrA -WindowStyle Hidden -PassThru
  $procB = Start-Process -FilePath $psql -ArgumentList ($baseArgs + (Join-Path $repo 'scripts\checkout-hardening-concurrency-b.sql')) -RedirectStandardOutput $concurrencyOutB -RedirectStandardError $concurrencyErrB -WindowStyle Hidden -PassThru
  $procA.WaitForExit()
  $procB.WaitForExit()
  Get-Content -LiteralPath $concurrencyOutA, $concurrencyErrA, $concurrencyOutB, $concurrencyErrB -ErrorAction SilentlyContinue

  Invoke-Psql (Join-Path $repo 'scripts\checkout-hardening-concurrency-verify.sql')
  Write-Output "checkout-hardening-runtime: PASS; cluster=$runRoot"
}
finally {
  & $pgctl stop -D $cluster -m fast -w | Out-Null
  Write-Output "isolated cluster stopped: $runRoot"
}
