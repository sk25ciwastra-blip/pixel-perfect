[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$pgBin = Join-Path $repo '.tools\postgresql-test\runtime\pgsql\bin'
$port = 55449
$dbName = 'owner_numbering_test'
$runRoot = Join-Path ([IO.Path]::GetTempPath()) ('baturaden25-numbering-runtime-' + [guid]::NewGuid().ToString('N'))
$cluster = Join-Path $runRoot 'cluster'
$serverOut = Join-Path $runRoot 'postgres.out.log'
$serverErr = Join-Path $runRoot 'postgres.err.log'

$psql = Join-Path $pgBin 'psql.exe'
$initdb = Join-Path $pgBin 'initdb.exe'
$createdb = Join-Path $pgBin 'createdb.exe'
$postgres = Join-Path $pgBin 'postgres.exe'
$pgctl = Join-Path $pgBin 'pg_ctl.exe'
$pgisready = Join-Path $pgBin 'pg_isready.exe'

New-Item -ItemType Directory -Path $runRoot -Force | Out-Null

try {
  & $initdb -D $cluster -U postgres --auth-local=trust --auth-host=trust --no-locale | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }

  $server = Start-Process -FilePath $postgres -ArgumentList @('-D', $cluster, '-h', '127.0.0.1', '-p', $port) -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr -WindowStyle Hidden -PassThru

  $ready = $false
  for ($attempt = 1; $attempt -le 60; $attempt++) {
    & $pgisready -h 127.0.0.1 -p $port -U postgres -d postgres | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw 'isolated PostgreSQL did not become ready' }

  & $createdb -h 127.0.0.1 -p $port -U postgres $dbName
  if ($LASTEXITCODE -ne 0) { throw 'createdb failed' }

  & $psql -X -h 127.0.0.1 -p $port -U postgres -d $dbName -v ON_ERROR_STOP=1 -f (Join-Path $repo 'scripts\owner-final-numbering-sql-runtime-tests.sql')
  if ($LASTEXITCODE -ne 0) { throw 'owner-final-numbering runtime SQL failed' }

  Write-Output "owner-final-numbering-runtime: PASS; cluster=$runRoot"
}
finally {
  if (Test-Path -LiteralPath $cluster) {
    & $pgctl stop -D $cluster -m fast -w | Out-Null
    Write-Output "isolated cluster stopped: $runRoot"
  }
}
