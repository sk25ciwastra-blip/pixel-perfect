[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$pgBin = Join-Path $repo '.tools\postgresql-test\runtime\pgsql\bin'
$drizzleDir = Join-Path $repo 'drizzle\migrations'
$migrationDir = Join-Path $repo 'supabase\migrations'
$port = 55433
$hostAddress = '127.0.0.1'
$dbName = 'baturaden25_finance150_test'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$runRoot = Join-Path ([IO.Path]::GetTempPath()) "baturaden25-finance150-isolated-$stamp"
$clusterDir = Join-Path $runRoot 'cluster'
$artifactDir = Join-Path $runRoot 'artifacts'
$started = $false
$postgresProcess = $null
$records = [System.Collections.Generic.List[object]]::new()

$InitDb = Join-Path $pgBin 'initdb.exe'
$PgCtl = Join-Path $pgBin 'pg_ctl.exe'
$PgIsReady = Join-Path $pgBin 'pg_isready.exe'
$Psql = Join-Path $pgBin 'psql.exe'
$Createdb = Join-Path $pgBin 'createdb.exe'
$Postgres = Join-Path $pgBin 'postgres.exe'

function Add-Record([string]$Stage, [string]$Status, [string]$SqlState = '', [string]$Detail = '') {
  $records.Add([pscustomobject]@{ Stage = $Stage; Status = $Status; SQLSTATE = $SqlState; Detail = $Detail })
}

function Get-SqlState([string]$Text) {
  $match = [regex]::Match($Text, '(?im)(?:SQLSTATE\s*[:=]\s*|ERROR:\s*)([0-9A-Z]{5})')
  if ($match.Success) { return $match.Groups[1].Value }
  return ''
}

function Invoke-LoggedPsql([string]$Stage, [string]$File, [string]$Database = $dbName) {
  $consoleLog = Join-Path $artifactDir "$Stage.console.log"
  $serverLog = Join-Path $artifactDir "$Stage.psql.log"
  Write-Host "[RUN] $Stage"
  $args = @(
    '-X', '-h', $hostAddress, '-p', $port, '-U', 'postgres', '-d', $Database,
    '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-f', $File, '-L', $serverLog
  )
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & $Psql @args 2>&1
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorAction
  $output | Out-File -LiteralPath $consoleLog -Encoding utf8
  if ($exitCode -ne 0) {
    $text = ($output | Out-String)
    $state = Get-SqlState $text
    Add-Record $Stage 'FAIL' $state "exit=$exitCode; log=$consoleLog"
    throw "psql failed at $Stage; SQLSTATE=$state; log=$consoleLog"
  }
  Add-Record $Stage 'PASS' '' "log=$consoleLog"
}

function Invoke-LoggedTool([string]$Stage, [string]$Exe, [string[]]$Arguments) {
  $log = Join-Path $artifactDir "$Stage.log"
  Write-Host "[RUN] $Stage"
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & $Exe @Arguments 2>&1
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorAction
  $output | Out-File -LiteralPath $log -Encoding utf8
  if ($exitCode -ne 0) {
    Add-Record $Stage 'FAIL' '' "exit=$exitCode; log=$log"
    throw "tool failed at $Stage; exit=$exitCode; log=$log"
  }
  Add-Record $Stage 'PASS' '' "log=$log"
}

function Invoke-LoggedRolePsql([string]$Stage, [string]$Role, [string]$File) {
  $consoleLog = Join-Path $artifactDir "$Stage.console.log"
  $serverLog = Join-Path $artifactDir "$Stage.psql.log"
  Write-Host "[RUN] $Stage as $Role"
  $args = @(
    '-X', '-h', $hostAddress, '-p', $port, '-U', $Role, '-d', $dbName,
    '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-f', $File, '-L', $serverLog
  )
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & $Psql @args 2>&1
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorAction
  $output | Out-File -LiteralPath $consoleLog -Encoding utf8
  if ($exitCode -ne 0) {
    $text = ($output | Out-String)
    $state = Get-SqlState $text
    Add-Record $Stage 'FAIL' $state "role=$Role; exit=$exitCode; log=$consoleLog"
    throw "psql failed at $Stage as $Role; SQLSTATE=$state; log=$consoleLog"
  }
  Add-Record $Stage 'PASS' '' "role=$Role; log=$consoleLog"
}

try {
  New-Item -ItemType Directory -Path $runRoot, $clusterDir, $artifactDir -Force | Out-Null
  if ((netstat -ano -p tcp | Select-String -Pattern (":$port\s"))) {
    throw "Port $port is not empty; refusing to start a cluster."
  }
  if (Test-Path -LiteralPath $clusterDir) {
    $children = Get-ChildItem -LiteralPath $clusterDir -Force
    if ($children.Count -gt 0) { throw "New cluster directory is not empty: $clusterDir" }
  }

  "run_root=$runRoot`ncluster=$clusterDir`nartifacts=$artifactDir`nhost=$hostAddress`nport=$port`ndatabase=$dbName`nprevious_cluster=.tools/postgresql-test/data (not used)" |
    Out-File -LiteralPath (Join-Path $artifactDir 'run-metadata.txt') -Encoding utf8

  Invoke-LoggedTool '01-initdb' $InitDb @('-D', $clusterDir, '-U', 'postgres', '--auth-local=trust', '--auth-host=trust', '--no-locale')
  $serverLog = Join-Path $artifactDir 'postgres-server.log'
  $serverErrorLog = Join-Path $artifactDir 'postgres-server-error.log'
  $started = $true
  $postgresProcess = Start-Process -FilePath $Postgres -ArgumentList @('-D', $clusterDir, '-h', $hostAddress, '-p', $port) -RedirectStandardOutput $serverLog -RedirectStandardError $serverErrorLog -WindowStyle Hidden -PassThru
  Add-Record '02-start-cluster' 'PASS' '' "pid=$($postgresProcess.Id); log=$serverLog"
  $readyLog = Join-Path $artifactDir '03-readiness.log'
  $ready = $false
  for ($attempt = 1; $attempt -le 60; $attempt++) {
    $readyOutput = & $PgIsReady -h $hostAddress -p $port -U postgres -d postgres 2>&1
    $readyOutput | Out-File -LiteralPath $readyLog -Encoding utf8 -Append
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) {
    Add-Record '03-readiness' 'FAIL' '' "log=$readyLog"
    throw "PostgreSQL did not become ready on $hostAddress`:$port; log=$readyLog"
  }
  Add-Record '03-readiness' 'PASS' '' "log=$readyLog"
  Invoke-LoggedTool '04-create-database' $Createdb @('-h', $hostAddress, '-p', $port, '-U', 'postgres', $dbName)

  $bootstrap = Join-Path $repo '.tools\postgresql-test\bootstrap-supabase-stubs.sql'
  Invoke-LoggedPsql '05-bootstrap-supabase-stubs' $bootstrap

  $drizzleBaseline = Get-ChildItem -LiteralPath $drizzleDir -Filter '*.sql' |
    Sort-Object Name |
    Where-Object { $_.Name -match '^000[0-5]_' }
  if ($drizzleBaseline.Count -ne 6) { throw "Expected Drizzle baseline 0000-0005, found $($drizzleBaseline.Count)." }
  foreach ($migration in $drizzleBaseline) {
    Invoke-LoggedPsql ("06-drizzle-" + $migration.BaseName) $migration.FullName
  }

  $financeFoundation = '20261015000000_finance_foundation.sql'
  $financeCompatibility = '20261015000001_finance_150_booking_compatibility.sql'
  $supervisorAlignment = '20261015000002_finance_150_supervisor_alignment.sql'
  $referencePrivileges = '20261015000003_booking_reference_read_privileges.sql'
  $baseline = Get-ChildItem -LiteralPath $migrationDir -Filter '*.sql' |
    Sort-Object Name |
    Where-Object { $_.Name -lt $financeFoundation }
  if ($baseline.Count -eq 0) { throw 'No baseline migrations found before Finance Foundation.' }
  $seedBoundary = '20261006000002_room_type_pricing_catalog.sql'
  $preSeedBaseline = $baseline | Where-Object { $_.Name -le $seedBoundary }
  $postSeedBaseline = $baseline | Where-Object { $_.Name -gt $seedBoundary }
  foreach ($migration in $preSeedBaseline) {
    Invoke-LoggedPsql ("10-baseline-" + $migration.BaseName) $migration.FullName
  }

  Invoke-LoggedPsql '20-seed-master-data' (Join-Path $repo '.tools\postgresql-test\seed-master-data.sql')
  Invoke-LoggedPsql '21-seed-receptionists' (Join-Path $repo '.tools\postgresql-test\seed-receptionists.sql')
  foreach ($migration in $postSeedBaseline) {
    Invoke-LoggedPsql ("11-baseline-post-seed-" + $migration.BaseName) $migration.FullName
  }
  Invoke-LoggedPsql '30-finance-foundation' (Join-Path $migrationDir $financeFoundation)
  Invoke-LoggedPsql '31-finance-compatibility' (Join-Path $migrationDir $financeCompatibility)
  Invoke-LoggedPsql '32-finance-supervisor-alignment' (Join-Path $migrationDir $supervisorAlignment)
  Invoke-LoggedPsql '33-booking-reference-read-privileges' (Join-Path $migrationDir $referencePrivileges)

  $testSql = @'
\set ON_ERROR_STOP on
\echo ==== FINANCE 150 DATABASE TESTS ====
SET timezone = 'Asia/Jakarta';

INSERT INTO auth.users (id)
VALUES ('44444444-4444-4444-8444-444444444444')
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
VALUES ('44444444-4444-4444-8444-444444444444', 'employee')
ON CONFLICT (user_id) DO UPDATE SET role = 'employee';
INSERT INTO public.employees (user_id, name, employee_id, position, active)
VALUES ('44444444-4444-4444-8444-444444444444', 'Supervisor Finance 150', 'TEST-SUP-150', 'supervisor', true)
ON CONFLICT (user_id) DO UPDATE SET position = 'supervisor', active = true;

SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
SELECT public.set_finance_settings('PERCENTAGE', 40);
DO $$
BEGIN
  IF (SELECT minimum_dp_mode FROM public.finance_settings WHERE id = true) <> 'PERCENTAGE'
     OR (SELECT minimum_dp_value FROM public.finance_settings WHERE id = true) <> 40 THEN
    RAISE EXCEPTION 'FAIL minimum DP setting';
  END IF;
  RAISE NOTICE 'PASS minimum DP 40%% configured';
END;
$$;

SELECT id AS room_full FROM public.rooms WHERE room_number = '06' \gset
SELECT id AS room_weekday FROM public.rooms WHERE room_number = '07' \gset
SELECT id AS room_weekend FROM public.rooms WHERE room_number = '08' \gset
SELECT id AS package_2h FROM public.packages WHERE name = 'Paket 2 Jam' \gset
SELECT id AS package_4h FROM public.packages WHERE name = 'Paket 4 Jam' \gset

SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
SELECT public.open_finance_cash_session(100000) AS session_id \gset
\set key_full 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set key_weekday 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set key_weekend 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
\set key_payment 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
\set key_payment_other '13131313-1313-4131-8131-131313131313'
\set key_expense 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
\set key_refund 'ffffffff-ffff-4fff-8fff-ffffffffffff'

SELECT public.create_reservation(
  'booking', :'room_full'::uuid, :'package_2h'::uuid,
  'Finance 150 Full', '081250000101', 'Alamat Finance 150',
  70000, 'Cash', 'weekend', '2026-11-11 10:00:00+07'::timestamptz,
  :'key_full'::uuid, :'session_id'::uuid
) AS tx_full_number \gset

SELECT public.create_reservation(
  'booking', :'room_weekday'::uuid, :'package_4h'::uuid,
  'Finance 150 Weekday', '081250000102', 'Alamat Finance 150',
  36000, 'Cash', 'weekend', '2026-11-10 10:00:00+07'::timestamptz,
  :'key_weekday'::uuid, :'session_id'::uuid
) AS tx_weekday_number \gset

SELECT public.create_reservation(
  'booking', :'room_weekend'::uuid, :'package_4h'::uuid,
  'Finance 150 Weekend', '081250000103', 'Alamat Finance 150',
  40000, 'Cash', 'weekday', '2026-11-15 10:00:00+07'::timestamptz,
  :'key_weekend'::uuid, :'session_id'::uuid
) AS tx_weekend_number \gset

DO $$
DECLARE
  weekday_price numeric;
  weekend_price numeric;
  weekday_mode text;
  weekend_mode text;
  payment_count integer;
  commission_amount numeric;
BEGIN
  SELECT t.price_snapshot, t.day_mode INTO weekday_price, weekday_mode
  FROM public.transactions t JOIN public.guests g ON g.id = t.guest_id
  WHERE g.phone = '081250000102';
  SELECT t.price_snapshot, t.day_mode INTO weekend_price, weekend_mode
  FROM public.transactions t JOIN public.guests g ON g.id = t.guest_id
  WHERE g.phone = '081250000103';
  SELECT p.commission_amount INTO commission_amount
  FROM public.payments p JOIN public.transactions t ON t.id = p.transaction_id
  JOIN public.guests g ON g.id = t.guest_id
  WHERE g.phone = '081250000102';
  IF weekday_price <> 90000 OR weekday_mode <> 'weekday' THEN
    RAISE EXCEPTION 'FAIL authoritative weekday mode/price: %, %', weekday_mode, weekday_price;
  END IF;
  IF weekend_price <> 100000 OR weekend_mode <> 'weekend' THEN
    RAISE EXCEPTION 'FAIL authoritative weekend mode/price: %, %', weekend_mode, weekend_price;
  END IF;
  SELECT COUNT(*) INTO payment_count FROM public.payments p
  JOIN public.transactions t ON t.id = p.transaction_id
  JOIN public.guests g ON g.id = t.guest_id WHERE g.phone = '081250000102';
  IF payment_count <> 1 OR commission_amount <> 2000 THEN
    RAISE EXCEPTION 'FAIL DP 40%% or commission: payment_count %, commission %', payment_count, commission_amount;
  END IF;
  RAISE NOTICE 'PASS DP 40%%, authoritative day mode, and 8%% commission snapshot';
END;
$$;

SELECT public.create_reservation(
  'booking', :'room_weekday'::uuid, :'package_4h'::uuid,
  'Finance 150 Weekday', '081250000102', 'Alamat Finance 150',
  36000, 'Cash', 'weekend', '2026-11-10 10:00:00+07'::timestamptz,
  :'key_weekday'::uuid, :'session_id'::uuid
) AS tx_weekday_replay;

DO $$
DECLARE
  raised boolean := false;
  state text;
  tx_count integer;
  room_id uuid;
  package_id uuid;
  session_id uuid;
BEGIN
  SELECT id INTO room_id FROM public.rooms WHERE room_number = '07';
  SELECT id INTO package_id FROM public.packages WHERE name = 'Paket 4 Jam';
  SELECT id INTO session_id FROM public.finance_cash_sessions
  WHERE opened_by = '22222222-2222-4222-8222-222222222222'::uuid AND status = 'OPEN';
  SELECT COUNT(*) INTO tx_count FROM public.transactions t JOIN public.guests g ON g.id = t.guest_id WHERE g.phone = '081250000102';
  IF tx_count <> 1 THEN RAISE EXCEPTION 'FAIL booking idempotent replay count: %', tx_count; END IF;
  BEGIN
    PERFORM public.create_reservation(
      'booking', room_id, package_id,
      'Finance 150 Conflict', '081250000102', 'Alamat Finance 150',
      35000, 'Cash', 'weekend', '2026-11-10 10:00:00+07'::timestamptz,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, session_id
    );
  EXCEPTION WHEN OTHERS THEN
    raised := true;
    GET STACKED DIAGNOSTICS state = RETURNED_SQLSTATE;
    RAISE NOTICE 'PASS booking idempotency conflict, SQLSTATE %', state;
  END;
  IF NOT raised THEN RAISE EXCEPTION 'FAIL booking idempotency conflict was accepted'; END IF;
END;
$$;

SELECT t.id AS tx_weekend_id
FROM public.transactions t JOIN public.guests g ON g.id = t.guest_id
WHERE g.phone = '081250000103' \gset
DO $$
DECLARE
  raised boolean := false;
  state text;
  tx_id uuid;
  session_id uuid;
BEGIN
  SELECT t.id INTO tx_id
  FROM public.transactions t JOIN public.guests g ON g.id = t.guest_id
  WHERE g.phone = '081250000103';
  SELECT id INTO session_id FROM public.finance_cash_sessions
  WHERE opened_by = '22222222-2222-4222-8222-222222222222'::uuid AND status = 'OPEN';
  BEGIN
    PERFORM public.record_transaction_payment(tx_id, 10000, 'Cash', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid, session_id);
  EXCEPTION WHEN OTHERS THEN
    raised := true;
    GET STACKED DIAGNOSTICS state = RETURNED_SQLSTATE;
    RAISE EXCEPTION 'FAIL payment idempotency identical payload, SQLSTATE %', state;
  END;
  IF raised THEN RAISE EXCEPTION 'FAIL payment idempotency identical payload'; END IF;
  PERFORM public.record_transaction_payment(tx_id, 10000, 'Cash', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid, session_id);
  IF (SELECT COUNT(*) FROM public.payments WHERE idempotency_key = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid) <> 1
     OR (SELECT COUNT(DISTINCT id) FROM public.payments WHERE idempotency_key = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid) <> 1
     OR (SELECT SUM(amount) FROM public.payments WHERE transaction_id = tx_id) <> 50000 THEN
    RAISE EXCEPTION 'FAIL identical payment retry duplicated row or amount';
  END IF;
  RAISE NOTICE 'PASS payment idempotency identical payload: one row, one payment amount';

  BEGIN
    PERFORM public.record_transaction_payment(tx_id, 11000, 'Cash', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid, session_id);
  EXCEPTION WHEN OTHERS THEN
    raised := true;
    GET STACKED DIAGNOSTICS state = RETURNED_SQLSTATE;
    IF state <> 'P0001' THEN RAISE EXCEPTION 'FAIL payload conflict SQLSTATE %', state; END IF;
    RAISE NOTICE 'PASS payment idempotency payload conflict rejected, SQLSTATE %', state;
  END;
  IF NOT raised OR (SELECT COUNT(*) FROM public.payments WHERE idempotency_key = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid) <> 1 THEN
    RAISE EXCEPTION 'FAIL payment idempotency payload conflict';
  END IF;

  PERFORM public.record_transaction_payment(tx_id, 5000, 'Cash', '13131313-1313-4131-8131-131313131313'::uuid, session_id);
  IF (SELECT COUNT(*) FROM public.payments WHERE idempotency_key = '13131313-1313-4131-8131-131313131313'::uuid) <> 1
     OR (SELECT SUM(amount) FROM public.payments WHERE transaction_id = tx_id) <> 55000 THEN
    RAISE EXCEPTION 'FAIL different idempotency key payment';
  END IF;
  RAISE NOTICE 'PASS different idempotency key creates one new payment';
END;
$$;

SET request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
SELECT public.record_finance_expense(:'key_expense'::uuid, :'session_id'::uuid, 5000, 'CASH', 'Bantuan sesi', 'Supervisor membantu sesi') AS expense_id \gset
SELECT public.record_finance_expense(:'key_expense'::uuid, :'session_id'::uuid, 5000, 'CASH', 'Bantuan sesi', 'Supervisor membantu sesi') AS expense_replay;
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.finance_expenses WHERE idempotency_key = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid) <> 1
     OR (SELECT recorded_by FROM public.finance_expenses WHERE idempotency_key = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid) <> '44444444-4444-4444-8444-444444444444'::uuid THEN
    RAISE EXCEPTION 'FAIL supervisor assistance expense';
  END IF;
  RAISE NOTICE 'PASS supervisor assistance on receptionist session';
END;
$$;

SELECT public.close_finance_cash_session(
  :'session_id'::uuid,
  jsonb_build_object(
    'setor_cash', 223000,
    'setor_transfer', 0,
    'di_laci', 33000,
    'dibawa', 0,
    'recipient_user_id', '44444444-4444-4444-8444-444444444444'
  ),
  'Supervisor closing assistance test'
) AS closing_snapshot \gset

SELECT id AS handoff_id FROM public.finance_drawer_handoffs WHERE source_session_id = :'session_id'::uuid \gset
SELECT public.confirm_finance_drawer_handover(:'handoff_id'::uuid, 33000, 'Jumlah sesuai') AS handoff_confirmation;

SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
SELECT t.id AS tx_full_id
FROM public.transactions t JOIN public.guests g ON g.id = t.guest_id
WHERE g.phone = '081250000101' \gset
SELECT public.create_finance_refund(
  :'key_refund'::uuid, :'tx_full_id'::uuid, 20000, 'CASH', 'OWNER_FUNDS', NULL::uuid,
  'Refund after closing test'
) AS refund_id \gset

DO $$
DECLARE
  refund_adjustment numeric;
  raised boolean := false;
  state text;
  summary jsonb;
  v_session_id uuid;
  tx_id uuid;
  v_handoff_id uuid;
BEGIN
  SELECT id INTO v_session_id FROM public.finance_cash_sessions
  WHERE opened_by = '22222222-2222-4222-8222-222222222222'::uuid;
  SELECT t.id INTO tx_id
  FROM public.transactions t JOIN public.guests g ON g.id = t.guest_id
  WHERE g.phone = '081250000101';
  SELECT id INTO v_handoff_id FROM public.finance_drawer_handoffs WHERE source_session_id = v_session_id;
  SELECT commission_adjustment INTO refund_adjustment FROM public.finance_refunds WHERE idempotency_key = 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid;
  IF refund_adjustment <> -1000 THEN RAISE EXCEPTION 'FAIL commission refund adjustment: %', refund_adjustment; END IF;
  BEGIN
    PERFORM public.create_finance_refund(
      '12121212-1212-4121-8121-121212121212'::uuid, tx_id, 1000,
      'CASH', 'SHIFT_CASH', v_session_id, 'Should reject final session source'
    );
  EXCEPTION WHEN OTHERS THEN
    raised := true;
    GET STACKED DIAGNOSTICS state = RETURNED_SQLSTATE;
    RAISE NOTICE 'PASS shift-cash refund after closing rejected, SQLSTATE %', state;
  END;
  IF NOT raised THEN RAISE EXCEPTION 'FAIL shift-cash refund after closing was accepted'; END IF;

  SELECT public.get_finance_session_summary(v_session_id) INTO summary;
  IF summary->>'status' <> 'FINAL'
     OR (summary->>'payments_total')::numeric <> 161000
     OR (summary->>'expenses')::numeric <> 5000
     OR (summary->'snapshot'->>'expected_cash')::numeric <> 256000
     OR (SELECT SUM(a.amount) FROM public.finance_session_allocations a WHERE a.session_id = v_session_id) <> 256000
     OR (SELECT h.status FROM public.finance_drawer_handoffs h WHERE h.id = v_handoff_id) <> 'SELESAI' THEN
    RAISE EXCEPTION 'FAIL closing/reconciliation: %', summary;
  END IF;
  RAISE NOTICE 'PASS refund after closing, commission adjustment, closing, and reconciliation';
END;
$$;

SELECT 'FINANCE150_DATABASE_TESTS_PASS' AS result;
'@
  $testSqlPath = Join-Path $artifactDir 'finance150-database-tests.sql'
  [IO.File]::WriteAllText($testSqlPath, $testSql, [Text.UTF8Encoding]::new($false))
  Invoke-LoggedPsql '40-finance150-database-tests' $testSqlPath

  $concurrencyLockSql = @'
\set ON_ERROR_STOP on
SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
SELECT public.open_finance_cash_session(0);
BEGIN;
SELECT t.id
FROM public.transactions t
JOIN public.guests g ON g.id = t.guest_id
WHERE g.phone = '081250000102'
FOR UPDATE;
SELECT pg_sleep(5);
COMMIT;
'@
  $concurrencyPaymentSql = @'
\set ON_ERROR_STOP on
SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
SELECT public.record_transaction_payment(
  (SELECT t.id FROM public.transactions t JOIN public.guests g ON g.id = t.guest_id WHERE g.phone = '081250000102'),
  5000,
  'Cash',
  'abababab-abab-4aba-8aba-abababababab'::uuid,
  (SELECT s.id FROM public.finance_cash_sessions s
   WHERE s.opened_by = '22222222-2222-4222-8222-222222222222'::uuid
     AND s.status = 'OPEN'
   ORDER BY s.opened_at DESC
   LIMIT 1)
);
'@
  $concurrencyVerifySql = @'
\set ON_ERROR_STOP on
SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
DO $$
DECLARE
  tx_id uuid;
  session_id uuid;
  summary jsonb;
BEGIN
  SELECT t.id INTO tx_id
  FROM public.transactions t JOIN public.guests g ON g.id = t.guest_id
  WHERE g.phone = '081250000102';
  SELECT s.id INTO session_id
  FROM public.finance_cash_sessions s
  WHERE s.opened_by = '22222222-2222-4222-8222-222222222222'::uuid
    AND s.status = 'OPEN'
  ORDER BY s.opened_at DESC
  LIMIT 1;
  IF (SELECT COUNT(*) FROM public.payments WHERE idempotency_key = 'abababab-abab-4aba-8aba-abababababab'::uuid) <> 1
     OR (SELECT SUM(amount) FROM public.payments WHERE transaction_id = tx_id) <> 41000
     OR (SELECT SUM(amount) FROM public.payments WHERE cash_session_id = session_id) <> 5000 THEN
    RAISE EXCEPTION 'FAIL concurrent payment idempotency row/transaction/cash totals';
  END IF;
  SELECT public.get_finance_session_summary(session_id) INTO summary;
  IF (summary->>'payments_total')::numeric <> 5000 THEN
    RAISE EXCEPTION 'FAIL concurrent retry cash summary: %', summary;
  END IF;
  PERFORM public.close_finance_cash_session(
    session_id,
    jsonb_build_object('setor_cash', 5000, 'setor_transfer', 0, 'di_laci', 0, 'dibawa', 0),
    'Concurrent payment idempotency verification'
  );
  RAISE NOTICE 'PASS two concurrent same-key requests: one payment row, transaction 41000, session cash 5000';
END;
$$;
SELECT 'PAYMENT_IDEMPOTENCY_CONCURRENCY_PASS' AS result;
'@
  $lockPath = Join-Path $artifactDir '41-concurrency-lock.sql'
  $paymentPath = Join-Path $artifactDir '41-concurrency-payment.sql'
  $verifyPath = Join-Path $artifactDir '42-concurrency-verification.sql'
  [IO.File]::WriteAllText($lockPath, $concurrencyLockSql, [Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText($paymentPath, $concurrencyPaymentSql, [Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText($verifyPath, $concurrencyVerifySql, [Text.UTF8Encoding]::new($false))

  $lockOut = Join-Path $artifactDir '41-concurrency-lock.console.log'
  $lockErr = Join-Path $artifactDir '41-concurrency-lock.error.log'
  $payment1Out = Join-Path $artifactDir '41-concurrency-payment-a.console.log'
  $payment1Err = Join-Path $artifactDir '41-concurrency-payment-a.error.log'
  $payment2Out = Join-Path $artifactDir '41-concurrency-payment-b.console.log'
  $payment2Err = Join-Path $artifactDir '41-concurrency-payment-b.error.log'
  $psqlBaseArgs = @('-X', '-h', $hostAddress, '-p', $port, '-U', 'postgres', '-d', $dbName, '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose')
  $lockProcess = Start-Process -FilePath $Psql -ArgumentList ($psqlBaseArgs + @('-f', $lockPath)) -RedirectStandardOutput $lockOut -RedirectStandardError $lockErr -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 1
  $paymentProcessA = Start-Process -FilePath $Psql -ArgumentList ($psqlBaseArgs + @('-f', $paymentPath)) -RedirectStandardOutput $payment1Out -RedirectStandardError $payment1Err -WindowStyle Hidden -PassThru
  $paymentProcessB = Start-Process -FilePath $Psql -ArgumentList ($psqlBaseArgs + @('-f', $paymentPath)) -RedirectStandardOutput $payment2Out -RedirectStandardError $payment2Err -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 7
  $paymentExitA = 'verified-by-log'
  $paymentExitB = 'verified-by-log'
  $lockExit = 'verified-by-log'
  $paymentErrorA = Get-Content -LiteralPath $payment1Err -Raw -ErrorAction SilentlyContinue
  $paymentErrorB = Get-Content -LiteralPath $payment2Err -Raw -ErrorAction SilentlyContinue
  $lockError = Get-Content -LiteralPath $lockErr -Raw -ErrorAction SilentlyContinue
  $paymentOutputA = Get-Content -LiteralPath $payment1Out -Raw -ErrorAction SilentlyContinue
  $paymentOutputB = Get-Content -LiteralPath $payment2Out -Raw -ErrorAction SilentlyContinue
  $lockOutput = Get-Content -LiteralPath $lockOut -Raw -ErrorAction SilentlyContinue
  $concurrencyErrorText = "$paymentErrorA$paymentErrorB$lockError"
  $concurrencyHasError = [bool]$paymentErrorA -or [bool]$paymentErrorB -or [bool]$lockError -or
    ($paymentOutputA -notmatch 'record_transaction_payment') -or
    ($paymentOutputB -notmatch 'record_transaction_payment') -or
    ($lockOutput -notmatch 'COMMIT')
  if ($concurrencyHasError) {
    $state = Get-SqlState $concurrencyErrorText
    Add-Record '41-payment-idempotency-concurrency' 'FAIL' $state "payment_a=$paymentExitA; payment_b=$paymentExitB; lock=$lockExit"
    throw "Concurrent payment idempotency failed; SQLSTATE=$state; logs=$payment1Err,$payment2Err"
  }
  Add-Record '41-payment-idempotency-concurrency' 'PASS' '' "two clients; logs=$payment1Out,$payment2Out"
  Invoke-LoggedPsql '42-payment-idempotency-concurrency-verification' $verifyPath

  $roleSetupSql = @'
\set ON_ERROR_STOP on
SELECT format('CREATE ROLE finance150_owner LOGIN NOSUPERUSER INHERIT')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finance150_owner') \gexec
SELECT format('CREATE ROLE finance150_supervisor LOGIN NOSUPERUSER INHERIT')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finance150_supervisor') \gexec
SELECT format('CREATE ROLE finance150_receptionist LOGIN NOSUPERUSER INHERIT')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finance150_receptionist') \gexec
GRANT authenticated TO finance150_owner, finance150_supervisor, finance150_receptionist;
'@
  $receptionistRoleSql = @'
\set ON_ERROR_STOP on
SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
SELECT public.open_finance_cash_session(0);
SELECT public.create_reservation(
  'booking',
  (SELECT id FROM public.rooms WHERE room_number = '11'),
  (SELECT id FROM public.packages WHERE name = 'Paket 24 Jam'),
  'Supervisor Assistance Target', '081250000201', 'Alamat Role Test',
  (SELECT CEIL(pr.weekday_price * 0.40)
   FROM public.rooms r
   JOIN public.room_types rt ON rt.id = r.room_type_id
   JOIN public.packages p ON p.name = 'Paket 24 Jam'
   JOIN public.package_room_type_prices pr ON pr.package_id = p.id AND pr.pricing_group = rt.pricing_group
   WHERE r.room_number = '11'),
  'Cash', 'weekday', '2026-10-13 10:00:00+07'::timestamptz,
  '56565656-5656-4565-8565-565656565656'::uuid,
  (SELECT id FROM public.finance_cash_sessions WHERE opened_by = '22222222-2222-4222-8222-222222222222'::uuid AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1)
);
SELECT public.record_transaction_payment(
  (SELECT t.id FROM public.transactions t JOIN public.guests g ON g.id = t.guest_id WHERE g.phone = '081250000201'),
  (SELECT t.price_snapshot - COALESCE(SUM(p.amount), 0)
   FROM public.transactions t
   JOIN public.guests g ON g.id = t.guest_id
   LEFT JOIN public.payments p ON p.transaction_id = t.id
   WHERE g.phone = '081250000201'
   GROUP BY t.id, t.price_snapshot),
  'Cash', '63636363-6363-4636-8636-636363636363'::uuid,
  (SELECT id FROM public.finance_cash_sessions WHERE opened_by = '22222222-2222-4222-8222-222222222222'::uuid AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1)
);
SELECT public.check_in_booking(
  (SELECT t.id FROM public.transactions t JOIN public.guests g ON g.id = t.guest_id WHERE g.phone = '081250000201')
);
SELECT public.create_reservation(
  'booking',
  (SELECT id FROM public.rooms WHERE room_number = '05'),
  (SELECT id FROM public.packages WHERE name = 'Paket 2 Jam'),
  'Supervisor Assistance Open Target', '081250000204', 'Alamat Role Test',
  (SELECT CEIL(pr.weekday_price * 0.40)
   FROM public.rooms r
   JOIN public.room_types rt ON rt.id = r.room_type_id
   JOIN public.packages p ON p.name = 'Paket 2 Jam'
   JOIN public.package_room_type_prices pr ON pr.package_id = p.id AND pr.pricing_group = rt.pricing_group
   WHERE r.room_number = '05'),
  'Cash', 'weekday', '2026-11-25 10:00:00+07'::timestamptz,
  '64646464-6464-4646-8646-646464646464'::uuid,
  (SELECT id FROM public.finance_cash_sessions WHERE opened_by = '22222222-2222-4222-8222-222222222222'::uuid AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1)
);
DO $$
DECLARE paid numeric; total numeric; status_value text;
BEGIN
  SELECT t.price_snapshot, COALESCE(SUM(p.amount), 0), t.status
  INTO total, paid, status_value
  FROM public.transactions t
  JOIN public.guests g ON g.id = t.guest_id
  LEFT JOIN public.payments p ON p.transaction_id = t.id
  WHERE g.phone = '081250000201'
  GROUP BY t.id, t.price_snapshot, t.status;
  IF paid <> total OR status_value <> 'check_in' THEN
    RAISE EXCEPTION 'FAIL Receptionist payment/check-in: paid %, total %, status %', paid, total, status_value;
  END IF;
  RAISE NOTICE 'PASS Receptionist payment and check-in';
END;
$$;
SELECT 'RECEPTIONIST_SETUP_PASS' AS result;
'@
  $ownerRoleSql = @'
\set ON_ERROR_STOP on
SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
SELECT public.upsert_finance_bank_account(NULL::uuid, 'Bank Role Test', 'Owner Role Test', 'ROLE-150', '', true);
SELECT public.record_finance_expense(
  '57575757-5757-4575-8575-575757575757'::uuid,
  (SELECT id FROM public.finance_cash_sessions WHERE opened_by = '22222222-2222-4222-8222-222222222222'::uuid AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1),
  1000, 'CASH', 'Owner bantuan', 'Owner membantu sesi Receptionist'
);
DO $$
DECLARE
  session_owner uuid;
  operator_id uuid;
BEGIN
  SELECT opened_by INTO session_owner FROM public.finance_cash_sessions WHERE opened_by = '22222222-2222-4222-8222-222222222222'::uuid AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;
  SELECT recorded_by INTO operator_id FROM public.finance_expenses WHERE idempotency_key = '57575757-5757-4575-8575-575757575757'::uuid;
  IF session_owner <> '22222222-2222-4222-8222-222222222222'::uuid OR operator_id <> '11111111-1111-4111-8111-111111111111'::uuid THEN
    RAISE EXCEPTION 'FAIL Owner assistance identity separation';
  END IF;
  RAISE NOTICE 'PASS Owner helps without taking session ownership';
END;
$$;
SELECT public.create_finance_refund(
  '58585858-5858-4585-8585-585858585858'::uuid,
  (SELECT t.id FROM public.transactions t JOIN public.guests g ON g.id = t.guest_id WHERE g.phone = '081250000101'),
  1000, 'CASH', 'OWNER_FUNDS', NULL::uuid, 'Role test Cash refund'
);
DO $$
DECLARE raised boolean := false; state text;
BEGIN
  BEGIN
    PERFORM public.close_finance_cash_session(
      (SELECT id FROM public.finance_cash_sessions WHERE opened_by = '22222222-2222-4222-8222-222222222222'::uuid AND status = 'FINAL' ORDER BY closed_at LIMIT 1),
      jsonb_build_object('setor_cash', 0, 'setor_transfer', 0, 'di_laci', 0, 'dibawa', 0),
      'FINAL mutation should fail'
    );
  EXCEPTION WHEN OTHERS THEN
    raised := true; GET STACKED DIAGNOSTICS state = RETURNED_SQLSTATE;
    IF state <> 'P0001' THEN RAISE EXCEPTION 'FAIL FINAL mutation SQLSTATE %', state; END IF;
    RAISE NOTICE 'PASS FINAL session mutation rejected, SQLSTATE %', state;
  END;
  IF NOT raised THEN RAISE EXCEPTION 'FAIL FINAL session mutation was accepted'; END IF;
END;
$$;
SELECT 'OWNER_ROLE_PASS' AS result;
'@
  $supervisorRoleSql = @'
\set ON_ERROR_STOP on
SET request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
DO $$
DECLARE session_id uuid;
BEGIN
  SELECT public.open_finance_cash_session(0) INTO session_id;
  IF (SELECT opened_by FROM public.finance_cash_sessions WHERE id = session_id) <> '44444444-4444-4444-8444-444444444444'::uuid THEN
    RAISE EXCEPTION 'FAIL Supervisor session owner';
  END IF;
  RAISE NOTICE 'PASS Supervisor opens own session';
END;
$$;

SELECT public.create_reservation(
  'booking',
  (SELECT id FROM public.rooms WHERE room_number = '09'),
  (SELECT id FROM public.packages WHERE name = 'Paket 2 Jam'),
  'Supervisor Booking', '081250000202', 'Alamat Role Test',
  28000, 'Cash', 'weekday', '2026-11-26 10:00:00+07'::timestamptz,
  '59595959-5959-4595-8595-595959595959'::uuid,
  (SELECT id FROM public.finance_cash_sessions WHERE opened_by = '44444444-4444-4444-8444-444444444444'::uuid AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1)
);

SELECT public.create_reservation(
  'check_in',
  (SELECT id FROM public.rooms WHERE room_number = '12'),
  (SELECT id FROM public.packages WHERE name = 'Paket 24 Jam'),
  'Supervisor Direct Checkin', '081250000203', 'Alamat Role Test',
  (SELECT pr.weekday_price
   FROM public.rooms r
   JOIN public.room_types rt ON rt.id = r.room_type_id
   JOIN public.packages p ON p.name = 'Paket 24 Jam'
   JOIN public.package_room_type_prices pr ON pr.package_id = p.id AND pr.pricing_group = rt.pricing_group
   WHERE r.room_number = '12'),
  'Cash', 'weekday', NULL,
  '60606060-6060-4606-8606-606060606060'::uuid,
  (SELECT id FROM public.finance_cash_sessions WHERE opened_by = '44444444-4444-4444-8444-444444444444'::uuid AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1)
);

SELECT public.record_transaction_payment(
  (SELECT t.id FROM public.transactions t JOIN public.guests g ON g.id = t.guest_id WHERE g.phone = '081250000204'),
  (SELECT t.price_snapshot - COALESCE(SUM(p.amount), 0)
   FROM public.transactions t
   JOIN public.guests g ON g.id = t.guest_id
   LEFT JOIN public.payments p ON p.transaction_id = t.id
   WHERE g.phone = '081250000204'
   GROUP BY t.id, t.price_snapshot),
  'Cash', '61616161-6161-4616-8616-616161616161'::uuid,
  (SELECT id FROM public.finance_cash_sessions WHERE opened_by = '22222222-2222-4222-8222-222222222222'::uuid AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1)
);

DO $$
DECLARE
  session_owner uuid;
  payment_operator uuid;
  guest_count integer;
  transaction_count integer;
  payment_count integer;
  employee_count integer;
  bank_count integer;
  raised boolean := false;
  state text;
BEGIN
  SELECT opened_by INTO session_owner FROM public.finance_cash_sessions WHERE opened_by = '22222222-2222-4222-8222-222222222222'::uuid AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;
  SELECT recorded_by INTO payment_operator FROM public.payments WHERE idempotency_key = '61616161-6161-4616-8616-616161616161'::uuid;
  SELECT COUNT(*) INTO guest_count FROM public.guests;
  SELECT COUNT(*) INTO transaction_count FROM public.transactions;
  SELECT COUNT(*) INTO payment_count FROM public.payments;
  SELECT COUNT(*) INTO employee_count FROM public.employees;
  SELECT COUNT(*) INTO bank_count FROM public.finance_bank_accounts;
  IF session_owner <> '22222222-2222-4222-8222-222222222222'::uuid OR payment_operator <> '44444444-4444-4444-8444-444444444444'::uuid THEN
    RAISE EXCEPTION 'FAIL Supervisor assistance identity separation';
  END IF;
  IF guest_count = 0 OR transaction_count = 0 OR payment_count = 0 OR employee_count = 0 OR bank_count = 0 THEN
    RAISE EXCEPTION 'FAIL Supervisor RLS read surface: guests %, transactions %, payments %, employees %, banks %', guest_count, transaction_count, payment_count, employee_count, bank_count;
  END IF;
  BEGIN
    INSERT INTO public.finance_expenses (idempotency_key, session_id, amount, method, category, recorded_by)
    VALUES ('62626262-6262-4626-8626-626262626262'::uuid, session_owner, 1, 'CASH', 'Direct mutation', auth.uid());
  EXCEPTION WHEN OTHERS THEN
    raised := true; GET STACKED DIAGNOSTICS state = RETURNED_SQLSTATE;
    IF state <> '42501' THEN RAISE EXCEPTION 'FAIL direct mutation SQLSTATE %', state; END IF;
    RAISE NOTICE 'PASS Supervisor direct finance mutation rejected, SQLSTATE %', state;
  END;
  IF NOT raised THEN RAISE EXCEPTION 'FAIL Supervisor direct finance mutation was accepted'; END IF;
  RAISE NOTICE 'PASS Supervisor reads required operational tables';
END;
$$;
SELECT 'SUPERVISOR_ROLE_PASS' AS result;
'@

  $roleSetupPath = Join-Path $artifactDir '43-role-setup.sql'
  $receptionistRolePath = Join-Path $artifactDir '44-receptionist-role.sql'
  $ownerRolePath = Join-Path $artifactDir '45-owner-role.sql'
  $supervisorRolePath = Join-Path $artifactDir '46-supervisor-role.sql'
  [IO.File]::WriteAllText($roleSetupPath, $roleSetupSql, [Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText($receptionistRolePath, $receptionistRoleSql, [Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText($ownerRolePath, $ownerRoleSql, [Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText($supervisorRolePath, $supervisorRoleSql, [Text.UTF8Encoding]::new($false))
  Invoke-LoggedPsql '43-role-setup' $roleSetupPath
  Invoke-LoggedRolePsql '44-receptionist-role' 'finance150_receptionist' $receptionistRolePath
  Invoke-LoggedRolePsql '45-owner-role' 'finance150_owner' $ownerRolePath
  Invoke-LoggedRolePsql '46-supervisor-role' 'finance150_supervisor' $supervisorRolePath

  Add-Record 'OVERALL' 'PASS' '' 'baseline + Finance Foundation + compatibility + database tests'
}
catch {
  $detail = $_.Exception.Message
  if (-not ($records | Where-Object { $_.Status -eq 'FAIL' })) {
    Add-Record 'OVERALL' 'FAIL' (Get-SqlState $detail) $detail
  }
  Write-Error $detail
  exit 1
}
finally {
  if ($started) {
    $stopLog = Join-Path $artifactDir '99-stop-cluster.log'
    $stopErrorLog = Join-Path $artifactDir '99-stop-cluster-error.log'
    $stopProcess = Start-Process -FilePath $PgCtl -ArgumentList @('stop', '-D', $clusterDir, '-m', 'fast', '-w', '-t', '60') -RedirectStandardOutput $stopLog -RedirectStandardError $stopErrorLog -WindowStyle Hidden -Wait -PassThru
    $statusLog = Join-Path $artifactDir '100-cluster-status.log'
    $statusErrorLog = Join-Path $artifactDir '100-cluster-status-error.log'
    $statusProcess = Start-Process -FilePath $PgCtl -ArgumentList @('status', '-D', $clusterDir) -RedirectStandardOutput $statusLog -RedirectStandardError $statusErrorLog -WindowStyle Hidden -Wait -PassThru
    $statusOutput = Get-Content -LiteralPath $statusLog -Raw -ErrorAction SilentlyContinue
    if ($statusOutput -match 'no server running') {
      Add-Record 'CLUSTER_STOP' 'PASS' '' "stop_exit=$($stopProcess.ExitCode); status=STOPPED; log=$stopLog"
    } else {
      Add-Record 'CLUSTER_STOP' 'FAIL' '' "stop_exit=$($stopProcess.ExitCode); status_exit=$($statusProcess.ExitCode)"
    }
  }
  if (Test-Path -LiteralPath $artifactDir) {
    $records | Format-Table -AutoSize | Out-String | Out-File -LiteralPath (Join-Path $artifactDir 'RESULTS.txt') -Encoding utf8
    $records | ConvertTo-Json -Depth 4 | Out-File -LiteralPath (Join-Path $artifactDir 'RESULTS.json') -Encoding utf8
    Write-Host "Artifacts: $artifactDir"
    Write-Host "Cluster retained stopped for inspection: $clusterDir"
  }
}
