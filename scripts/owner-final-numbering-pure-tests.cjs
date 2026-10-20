const assert = require('node:assert/strict');
const fs = require('node:fs');

const migration = fs.readFileSync('supabase/migrations/20261019000000_owner_final_numbering.sql', 'utf8');
const preflight = fs.readFileSync('supabase/reconciliation/owner_final_numbering_preflight.sql', 'utf8');
const transactionRoute = fs.readFileSync('src/routes/transaksi.tsx', 'utf8');
const financeRoute = fs.readFileSync('src/routes/keuangan.tsx', 'utf8');

assert.match(migration, /owner_transaction_number_seq[\s\S]*NO MAXVALUE/);
assert.match(migration, /owner_housekeeping_number_seq[\s\S]*NO MAXVALUE/);
assert.match(migration, /owner_expense_number_seq[\s\S]*NO MAXVALUE/);
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.enforce_transaction_identity/);
assert.match(migration, /enforce_transaction_identity\(\)[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = pg_catalog, public/);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.enforce_transaction_identity\(\) FROM PUBLIC, anon, authenticated/);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.next_transaction_number\(\) FROM PUBLIC/);
assert.match(migration, /ALTER TABLE public\.transactions[\s\S]*ALTER COLUMN transaction_number[\s\S]*DROP DEFAULT/);
assert.match(migration, /NEW\.transaction_number := public\.next_transaction_number\(\)/);
assert.doesNotMatch(migration, /NEW\.transaction_number := 'BTRD25-'/);
assert.match(migration, /format\([\s\S]*'BTRDTRX-%s'[\s\S]*sequence_value < 1000000[\s\S]*lpad\(sequence_value::text, 6, '0'\)/);
assert.match(migration, /format\([\s\S]*'BTRDHK-%s'[\s\S]*sequence_value < 1000000[\s\S]*lpad\(sequence_value::text, 6, '0'\)/);
assert.match(migration, /format\([\s\S]*'BTRDEXP-%s'[\s\S]*sequence_value < 1000000[\s\S]*lpad\(sequence_value::text, 6, '0'\)/);
assert.match(migration, /ALTER TABLE public.finance_expenses[\s\S]*ADD COLUMN IF NOT EXISTS expense_number text/);
assert.match(migration, /finance_expenses_expense_number_unique/);
assert.match(migration, /transaction_number_format_forward_compatible/);
assert.match(migration, /housekeeping_jobs_job_number_format_forward_compatible/);
assert.match(migration, /max_transaction_number/);
assert.match(migration, /max_housekeeping_number/);
assert.match(preflight, /legacy_without_number/);
assert.match(preflight, /transaction_duplicate/);
assert.match(transactionRoute, /BTRDTRX-\(\\d\+\)/);
assert.match(transactionRoute, /BTRD25-TRX-\(\\d\+\)-\\d\{2\}/);
assert.match(financeRoute, /expense_number/);
assert.match(financeRoute, /Cari nomor pengeluaran/);

console.log('owner-final-numbering-pure-tests: PASS');
