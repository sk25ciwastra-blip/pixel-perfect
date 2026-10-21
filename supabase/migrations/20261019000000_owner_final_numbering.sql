BEGIN;

-- P0-01 / keputusan Owner: nomorator forward-only tanpa tahun.
-- Migration ini tidak mengubah nomor lama dan tidak melakukan backfill.

DO $preflight$
BEGIN
  IF to_regclass('public.transactions') IS NULL
     OR to_regclass('public.housekeeping_jobs') IS NULL
     OR to_regclass('public.housekeeping_history') IS NULL
     OR to_regclass('public.finance_expenses') IS NULL THEN
    RAISE EXCEPTION
      'Nomorator final membutuhkan transactions, housekeeping_jobs, housekeeping_history, dan finance_expenses';
  END IF;
END;
$preflight$;
DO $history_preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.transactions
    GROUP BY transaction_number
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Nomor transaksi historis duplikat; aktivasi dibatalkan';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.transactions
    WHERE transaction_number !~ '^BTRDTRX-[0-9]{6,}$'
      AND transaction_number !~ '^BTRD25-TRX-[0-9]{6}-[0-9]{2}$'
      AND transaction_number !~ '^BTRD25-[0-9]{6}$'
  ) THEN
    RAISE EXCEPTION 'Nomor transaksi historis memiliki format tidak dikenal';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.housekeeping_jobs
    GROUP BY job_number
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Nomor Housekeeping historis duplikat; aktivasi dibatalkan';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.housekeeping_jobs
    WHERE job_number !~ '^BTRDHK-[0-9]{6,}$'
      AND job_number !~ '^BTRD25-HK-[0-9]{6}-[0-9]{2}$'
  ) THEN
    RAISE EXCEPTION 'Nomor Housekeeping historis memiliki format tidak dikenal';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.housekeeping_history
    WHERE job_number IS NOT NULL
      AND job_number !~ '^BTRDHK-[0-9]{6,}$'
      AND job_number !~ '^BTRD25-HK-[0-9]{6}-[0-9]{2}$'
  ) THEN
    RAISE EXCEPTION 'Nomor Housekeeping history memiliki format tidak dikenal';
  END IF;
END;
$history_preflight$;

CREATE TEMP TABLE _owner_numbering_transactions ON COMMIT DROP AS
SELECT id, transaction_number FROM public.transactions;
CREATE TEMP TABLE _owner_numbering_housekeeping_jobs ON COMMIT DROP AS
SELECT id, job_number FROM public.housekeeping_jobs;
CREATE TEMP TABLE _owner_numbering_housekeeping_history ON COMMIT DROP AS
SELECT id, job_number FROM public.housekeeping_history;
CREATE TEMP TABLE _owner_numbering_expenses ON COMMIT DROP AS
SELECT id FROM public.finance_expenses;
CREATE TEMP TABLE _owner_numbering_payments ON COMMIT DROP AS
SELECT id, transaction_id, amount, method, kind, created_at, recorded_by FROM public.payments;
CREATE TEMP TABLE _owner_numbering_employees ON COMMIT DROP AS
SELECT id, user_id, position, active FROM public.employees;
CREATE TEMP TABLE _owner_numbering_roles ON COMMIT DROP AS
SELECT user_id, role FROM public.user_roles;

CREATE SEQUENCE IF NOT EXISTS public.owner_transaction_number_seq
  AS bigint
  MINVALUE 1
  NO MAXVALUE
  START WITH 1;

CREATE SEQUENCE IF NOT EXISTS public.owner_housekeeping_number_seq
  AS bigint
  MINVALUE 1
  NO MAXVALUE
  START WITH 1;

CREATE SEQUENCE IF NOT EXISTS public.owner_expense_number_seq
  AS bigint
  MINVALUE 1
  NO MAXVALUE
  START WITH 1;

ALTER TABLE public.finance_expenses
  ADD COLUMN IF NOT EXISTS expense_number text;

-- Titik awal baru adalah satu angka di atas angka terbesar yang pernah tersimpan
-- pada kategori tersebut. Format lama ikut dibaca agar audit tidak mengasumsikan
-- semua seri dapat dimulai kembali dari 000001.
DO $sequence_sync$
DECLARE
  max_transaction_number bigint;
  max_housekeeping_number bigint;
BEGIN
  SELECT max(number_value)
  INTO max_transaction_number
  FROM (
    SELECT (substring(t.transaction_number FROM '^BTRDTRX-([0-9]+)$'))::bigint AS number_value
    FROM public.transactions t
    WHERE t.transaction_number ~ '^BTRDTRX-[0-9]+$'
    UNION ALL
    SELECT (substring(t.transaction_number FROM '^BTRD25-TRX-([0-9]{6})-[0-9]{2}$'))::bigint
    FROM public.transactions t
    WHERE t.transaction_number ~ '^BTRD25-TRX-[0-9]{6}-[0-9]{2}$'
    UNION ALL
    SELECT (substring(t.transaction_number FROM '^BTRD25-([0-9]{6})$'))::bigint
    FROM public.transactions t
    WHERE t.transaction_number ~ '^BTRD25-[0-9]{6}$'
  ) numbers;

  SELECT max(number_value)
  INTO max_housekeeping_number
  FROM (
    SELECT (substring(j.job_number FROM '^BTRDHK-([0-9]+)$'))::bigint AS number_value
    FROM public.housekeeping_jobs j
    WHERE j.job_number ~ '^BTRDHK-[0-9]+$'
    UNION ALL
    SELECT (substring(j.job_number FROM '^BTRD25-HK-([0-9]{6})-[0-9]{2}$'))::bigint
    FROM public.housekeeping_jobs j
    WHERE j.job_number ~ '^BTRD25-HK-[0-9]{6}-[0-9]{2}$'
    UNION ALL
    SELECT (substring(h.job_number FROM '^BTRDHK-([0-9]+)$'))::bigint
    FROM public.housekeeping_history h
    WHERE h.job_number ~ '^BTRDHK-[0-9]+$'
    UNION ALL
    SELECT (substring(h.job_number FROM '^BTRD25-HK-([0-9]{6})-[0-9]{2}$'))::bigint
    FROM public.housekeeping_history h
    WHERE h.job_number ~ '^BTRD25-HK-[0-9]{6}-[0-9]{2}$'
  ) numbers;

  IF max_transaction_number IS NOT NULL THEN
    IF max_transaction_number = 9223372036854775807 THEN
      RAISE EXCEPTION 'Urutan nomor transaksi tidak memiliki ruang bigint tersisa';
    END IF;
    PERFORM setval(
      'public.owner_transaction_number_seq',
      max_transaction_number,
      true
    );
  END IF;

  IF max_housekeeping_number IS NOT NULL THEN
    IF max_housekeeping_number = 9223372036854775807 THEN
      RAISE EXCEPTION 'Urutan nomor Housekeeping tidak memiliki ruang bigint tersisa';
    END IF;
    PERFORM setval(
      'public.owner_housekeeping_number_seq',
      max_housekeeping_number,
      true
    );
  END IF;
END;
$sequence_sync$;

CREATE OR REPLACE FUNCTION public.next_transaction_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  sequence_value bigint;
BEGIN
  sequence_value := nextval('public.owner_transaction_number_seq');
  RETURN format(
    'BTRDTRX-%s',
    CASE
      WHEN sequence_value < 1000000 THEN lpad(sequence_value::text, 6, '0')
      ELSE sequence_value::text
    END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.next_housekeeping_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  sequence_value bigint;
BEGIN
  sequence_value := nextval('public.owner_housekeeping_number_seq');
  RETURN format(
    'BTRDHK-%s',
    CASE
      WHEN sequence_value < 1000000 THEN lpad(sequence_value::text, 6, '0')
      ELSE sequence_value::text
    END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.next_expense_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  sequence_value bigint;
BEGIN
  sequence_value := nextval('public.owner_expense_number_seq');
  RETURN format(
    'BTRDEXP-%s',
    CASE
      WHEN sequence_value < 1000000 THEN lpad(sequence_value::text, 6, '0')
      ELSE sequence_value::text
    END
  );
END;
$function$;

-- Constraint lama menerima format lama sekaligus format resmi yang sudah pernah
-- diterbitkan. Nomor lama tetap valid dan tidak disentuh.
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transaction_number_format;

DO $transaction_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND conname = 'transaction_number_format_forward_compatible'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transaction_number_format_forward_compatible
      CHECK (
        transaction_number ~ '^BTRDTRX-[0-9]{6,}$'
        OR transaction_number ~ '^BTRD25-TRX-[0-9]{6}-[0-9]{2}$'
        OR transaction_number ~ '^BTRD25-[0-9]{6}$'
      );
  END IF;
END;
$transaction_constraint$;

-- 14000 memakai constraint inline pada housekeeping_jobs. Hapus hanya check
-- yang memaksa format tahun, lalu pasang check kompatibel baru.
DO $housekeeping_constraints$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.housekeeping_jobs'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%BTRD25-HK-%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.housekeeping_jobs DROP CONSTRAINT %I',
      constraint_name
    );
  END LOOP;

  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.housekeeping_history'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%BTRD25-HK-%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.housekeeping_history DROP CONSTRAINT %I',
      constraint_name
    );
  END LOOP;
END;
$housekeeping_constraints$;

DO $housekeeping_format_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.housekeeping_jobs'::regclass
      AND conname = 'housekeeping_jobs_job_number_format_forward_compatible'
  ) THEN
    ALTER TABLE public.housekeeping_jobs
      ADD CONSTRAINT housekeeping_jobs_job_number_format_forward_compatible
      CHECK (
        job_number ~ '^BTRDHK-[0-9]{6,}$'
        OR job_number ~ '^BTRD25-HK-[0-9]{6}-[0-9]{2}$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.housekeeping_history'::regclass
      AND conname = 'housekeeping_history_job_number_format_forward_compatible'
  ) THEN
    ALTER TABLE public.housekeeping_history
      ADD CONSTRAINT housekeeping_history_job_number_format_forward_compatible
      CHECK (
        job_number IS NULL
        OR job_number ~ '^BTRDHK-[0-9]{6,}$'
        OR job_number ~ '^BTRD25-HK-[0-9]{6}-[0-9]{2}$'
      );
  END IF;
END;
$housekeeping_format_constraints$;

ALTER TABLE public.transactions
  ALTER COLUMN transaction_number
  DROP DEFAULT;

-- The baseline/Staging trigger historically rewrote every authenticated
-- insert through transaction_number_seq. Keep its created_by protection, but
-- make its number path honor the Owner-final generator instead of the legacy
-- BTRD25-###### sequence.
CREATE OR REPLACE FUNCTION public.enforce_transaction_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  -- The trigger is the single insert path. Dropping the historical default
  -- above avoids consuming two sequence values and prevents caller-supplied
  -- numbers from bypassing the Owner-final generator.
  NEW.transaction_number := public.next_transaction_number();

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS transaction_identity_insert
ON public.transactions;

CREATE TRIGGER transaction_identity_insert
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_transaction_identity();

REVOKE ALL ON FUNCTION public.enforce_transaction_identity() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.housekeeping_jobs
  ALTER COLUMN job_number
  SET DEFAULT public.next_housekeeping_number();

ALTER TABLE public.finance_expenses
  ALTER COLUMN expense_number
  SET DEFAULT public.next_expense_number();

DO $expense_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.finance_expenses'::regclass
      AND conname = 'finance_expenses_expense_number_format_check'
  ) THEN
    ALTER TABLE public.finance_expenses
      ADD CONSTRAINT finance_expenses_expense_number_format_check
      CHECK (
        expense_number IS NULL
        OR expense_number ~ '^BTRDEXP-[0-9]{6,}$'
      );
  END IF;
END;
$expense_constraint$;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_transaction_number_owner_final_unique
  ON public.transactions (transaction_number);

CREATE UNIQUE INDEX IF NOT EXISTS housekeeping_jobs_job_number_owner_final_unique
  ON public.housekeeping_jobs (job_number);

CREATE UNIQUE INDEX IF NOT EXISTS finance_expenses_expense_number_unique
  ON public.finance_expenses (expense_number)
  WHERE expense_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_number_created_at_idx
  ON public.transactions (transaction_number, created_at DESC);

CREATE INDEX IF NOT EXISTS housekeeping_number_created_at_idx
  ON public.housekeeping_jobs (job_number, created_at DESC);

CREATE INDEX IF NOT EXISTS finance_expenses_number_created_at_idx
  ON public.finance_expenses (expense_number, created_at DESC);

REVOKE ALL ON FUNCTION public.next_transaction_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_housekeeping_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_expense_number() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.next_transaction_number() TO postgres;
GRANT EXECUTE ON FUNCTION public.next_housekeeping_number() TO postgres;
GRANT EXECUTE ON FUNCTION public.next_expense_number() TO postgres;

DO $numbering_postcheck$
BEGIN
  IF (SELECT count(*) FROM public.transactions) <> (SELECT count(*) FROM _owner_numbering_transactions)
     OR (SELECT count(*) FROM public.finance_expenses) <> (SELECT count(*) FROM _owner_numbering_expenses)
     OR (SELECT count(*) FROM public.payments) <> (SELECT count(*) FROM _owner_numbering_payments)
     OR (SELECT count(*) FROM public.employees) <> (SELECT count(*) FROM _owner_numbering_employees)
     OR (SELECT count(*) FROM public.user_roles) <> (SELECT count(*) FROM _owner_numbering_roles) THEN
    RAISE EXCEPTION 'Nomorator mengubah jumlah row histori/core';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.transactions t
    FULL OUTER JOIN _owner_numbering_transactions b ON b.id = t.id
    WHERE t.id IS NULL OR b.id IS NULL OR t.transaction_number IS DISTINCT FROM b.transaction_number
  ) THEN
    RAISE EXCEPTION 'Nomor transaksi historis berubah atau hilang';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.housekeeping_jobs j
    FULL OUTER JOIN _owner_numbering_housekeeping_jobs b ON b.id = j.id
    WHERE j.id IS NULL OR b.id IS NULL OR j.job_number IS DISTINCT FROM b.job_number
  ) THEN
    RAISE EXCEPTION 'Nomor Housekeeping historis berubah atau hilang';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.housekeeping_history h
    FULL OUTER JOIN _owner_numbering_housekeeping_history b ON b.id = h.id
    WHERE h.id IS NULL OR b.id IS NULL OR h.job_number IS DISTINCT FROM b.job_number
  ) THEN
    RAISE EXCEPTION 'Housekeeping history berubah atau hilang';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payments p
    FULL OUTER JOIN _owner_numbering_payments b ON b.id = p.id
    WHERE p.id IS NULL OR b.id IS NULL
       OR p.transaction_id IS DISTINCT FROM b.transaction_id
       OR p.amount IS DISTINCT FROM b.amount
       OR p.method IS DISTINCT FROM b.method
       OR p.kind IS DISTINCT FROM b.kind
       OR p.created_at IS DISTINCT FROM b.created_at
       OR p.recorded_by IS DISTINCT FROM b.recorded_by
  ) THEN
    RAISE EXCEPTION 'Payment histori berubah atau hilang';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.finance_expenses e
    FULL OUTER JOIN _owner_numbering_expenses b ON b.id = e.id
    WHERE e.id IS NULL OR b.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Finance expense histori berubah atau hilang';
  END IF;

  IF EXISTS (SELECT 1 FROM public.transactions GROUP BY transaction_number HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM public.housekeeping_jobs GROUP BY job_number HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM public.finance_expenses WHERE expense_number IS NOT NULL GROUP BY expense_number HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplikasi nomor setelah aktivasi nomorator';
  END IF;

  IF to_regprocedure('public.next_transaction_number()') IS NULL
     OR to_regprocedure('public.next_housekeeping_number()') IS NULL
     OR to_regprocedure('public.next_expense_number()') IS NULL
     OR to_regclass('public.transactions_transaction_number_owner_final_unique') IS NULL
     OR to_regclass('public.housekeeping_jobs_job_number_owner_final_unique') IS NULL
     OR to_regclass('public.finance_expenses_expense_number_unique') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'transaction_identity_insert' AND tgrelid = 'public.transactions'::regclass)
  THEN
    RAISE EXCEPTION 'Objek nomorator final tidak lengkap';
  END IF;

  IF has_function_privilege('anon','public.next_transaction_number()'::regprocedure,'EXECUTE')
     OR has_function_privilege('anon','public.next_housekeeping_number()'::regprocedure,'EXECUTE')
     OR has_function_privilege('anon','public.next_expense_number()'::regprocedure,'EXECUTE') THEN
    RAISE EXCEPTION 'Generator nomorator dapat dipanggil anon/PUBLIC';
  END IF;
END;
$numbering_postcheck$;
COMMIT;
