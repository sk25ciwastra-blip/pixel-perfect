BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.transactions') IS NULL
     OR to_regclass('public.housekeeping_history') IS NULL
     OR to_regclass('public.housekeeping_checklists') IS NULL
     OR to_regclass('public.activity_logs') IS NULL THEN
    RAISE EXCEPTION
      'Nomor resmi membutuhkan transactions, housekeeping_history, housekeeping_checklists, dan activity_logs';
  END IF;

  IF to_regprocedure('public.can_housekeeping(uuid)') IS NULL
     OR to_regprocedure('public.has_employee_position(uuid,public.employee_position[])') IS NULL
     OR to_regprocedure('public.has_role(uuid,public.app_role)') IS NULL THEN
    RAISE EXCEPTION
      'Nomor resmi membutuhkan fungsi otorisasi Housekeeping yang sudah tersedia';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transactions'
      AND column_name = 'transaction_number'
      AND data_type = 'text'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION
      'transactions.transaction_number harus text NOT NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'housekeeping_history'
      AND column_name = 'transaction_id'
  ) THEN
    RAISE EXCEPTION
      'housekeeping_history.transaction_id wajib tersedia';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activity_logs'
      AND column_name IN ('id', 'action', 'entity_id', 'created_at')
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 4
  ) THEN
    RAISE EXCEPTION
      'activity_logs tidak memiliki bukti checkout yang dibutuhkan';
  END IF;

  IF EXISTS (
    SELECT transaction_number
    FROM public.transactions
    GROUP BY transaction_number
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Nomor transaksi duplikat ditemukan; migrasi dihentikan tanpa backfill';
  END IF;
END;
$preflight$;

CREATE SEQUENCE IF NOT EXISTS public.transactions_number_seq
  AS bigint
  MINVALUE 1
  MAXVALUE 999999
  START WITH 1;

CREATE SEQUENCE IF NOT EXISTS public.housekeeping_number_seq
  AS bigint
  MINVALUE 1
  MAXVALUE 999999
  START WITH 1;

ALTER TABLE public.housekeeping_history
  ADD COLUMN IF NOT EXISTS job_number text;

ALTER TABLE public.housekeeping_history
  ADD COLUMN IF NOT EXISTS job_id uuid;

CREATE TABLE IF NOT EXISTS public.housekeeping_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number text NOT NULL UNIQUE
    CHECK (job_number ~ '^BTRD25-HK-[0-9]{6}-[0-9]{2}$'),
  room_id uuid NOT NULL REFERENCES public.rooms(id),
  transaction_id uuid REFERENCES public.transactions(id)
    ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT housekeeping_jobs_transaction_unique UNIQUE (transaction_id)
);

CREATE TABLE IF NOT EXISTS public.housekeeping_transaction_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  checkout_activity_log_id uuid NOT NULL REFERENCES public.activity_logs(id),
  resolved_by uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL,
  evidence_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS housekeeping_transaction_resolutions_room_idx
  ON public.housekeeping_transaction_resolutions (room_id, created_at DESC);

ALTER TABLE public.housekeeping_transaction_resolutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS housekeeping_transaction_resolutions_read
ON public.housekeeping_transaction_resolutions;

CREATE POLICY housekeeping_transaction_resolutions_read
ON public.housekeeping_transaction_resolutions
FOR SELECT
TO authenticated
USING (
  public.can_housekeeping(auth.uid())
  OR public.has_employee_position(
    auth.uid(),
    array['inspector'::public.employee_position]
  )
);

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.housekeeping_transaction_resolutions
FROM PUBLIC, anon, authenticated;

GRANT SELECT
ON TABLE public.housekeeping_transaction_resolutions
TO authenticated;

DO $job_structure$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.housekeeping_jobs'::regclass
      AND conname = 'housekeeping_jobs_id_number_unique'
  ) THEN
    ALTER TABLE public.housekeeping_jobs
      ADD CONSTRAINT housekeeping_jobs_id_number_unique
      UNIQUE (id, job_number);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.housekeeping_history'::regclass
      AND conname = 'housekeeping_history_job_identity_check'
  ) THEN
    ALTER TABLE public.housekeeping_history
      ADD CONSTRAINT housekeeping_history_job_identity_check
      CHECK (
        (job_id IS NULL AND job_number IS NULL)
        OR (job_id IS NOT NULL AND job_number IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.housekeeping_history'::regclass
      AND conname = 'housekeeping_history_job_identity_fkey'
  ) THEN
    ALTER TABLE public.housekeeping_history
      ADD CONSTRAINT housekeeping_history_job_identity_fkey
      FOREIGN KEY (job_id, job_number)
      REFERENCES public.housekeeping_jobs(id, job_number)
      ON DELETE SET NULL;
  END IF;
END;
$job_structure$;

CREATE INDEX IF NOT EXISTS housekeeping_jobs_room_created_idx
  ON public.housekeeping_jobs (room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS housekeeping_jobs_transaction_idx
  ON public.housekeeping_jobs (transaction_id);

ALTER TABLE public.housekeeping_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS housekeeping_jobs_read
ON public.housekeeping_jobs;

CREATE POLICY housekeeping_jobs_read
ON public.housekeeping_jobs
FOR SELECT
TO authenticated
USING (
  public.can_housekeeping(auth.uid())
  OR public.has_employee_position(
    auth.uid(),
    array['inspector'::public.employee_position]
  )
);

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.housekeeping_jobs
FROM PUBLIC, anon, authenticated;

GRANT SELECT
ON TABLE public.housekeeping_jobs
TO authenticated;

DO $sequence_sync$
DECLARE
  max_transaction_number bigint;
  max_housekeeping_number bigint;
  current_transaction_sequence bigint;
  current_housekeeping_sequence bigint;
  transaction_sequence_called boolean;
  housekeeping_sequence_called boolean;
BEGIN
  SELECT max((substring(t.transaction_number FROM '^BTRD25-TRX-([0-9]{6})-[0-9]{2}$'))::bigint)
  INTO max_transaction_number
  FROM public.transactions t
  WHERE t.transaction_number ~ '^BTRD25-TRX-[0-9]{6}-[0-9]{2}$';

  SELECT max(number_value)
  INTO max_housekeeping_number
  FROM (
    SELECT (substring(h.job_number FROM '^BTRD25-HK-([0-9]{6})-[0-9]{2}$'))::bigint AS number_value
    FROM public.housekeeping_history h
    WHERE h.job_number ~ '^BTRD25-HK-[0-9]{6}-[0-9]{2}$'
    UNION ALL
    SELECT (substring(j.job_number FROM '^BTRD25-HK-([0-9]{6})-[0-9]{2}$'))::bigint AS number_value
    FROM public.housekeeping_jobs j
    WHERE j.job_number ~ '^BTRD25-HK-[0-9]{6}-[0-9]{2}$'
  ) numbers;

  SELECT last_value, is_called
  INTO current_transaction_sequence, transaction_sequence_called
  FROM public.transactions_number_seq;

  SELECT last_value, is_called
  INTO current_housekeeping_sequence, housekeeping_sequence_called
  FROM public.housekeeping_number_seq;

  IF max_transaction_number IS NOT NULL
     AND (
       NOT transaction_sequence_called
       OR current_transaction_sequence < max_transaction_number
     ) THEN
    PERFORM setval(
      'public.transactions_number_seq',
      max_transaction_number,
      true
    );
  END IF;

  IF max_housekeeping_number IS NOT NULL
     AND (
       NOT housekeeping_sequence_called
       OR current_housekeeping_sequence < max_housekeeping_number
     ) THEN
    PERFORM setval(
      'public.housekeeping_number_seq',
      max_housekeeping_number,
      true
    );
  END IF;
END;
$sequence_sync$;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_transaction_number_unique_v1
  ON public.transactions (transaction_number);

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.housekeeping_history'::regclass
      AND conname = 'housekeeping_history_job_number_format_check'
  ) THEN
    ALTER TABLE public.housekeeping_history
      ADD CONSTRAINT housekeeping_history_job_number_format_check
      CHECK (
        job_number IS NULL
        OR job_number ~ '^BTRD25-HK-[0-9]{6}-[0-9]{2}$'
      );
  END IF;
END;
$constraint$;

CREATE INDEX IF NOT EXISTS housekeeping_history_job_number_created_idx
  ON public.housekeeping_history (job_number, created_at DESC);

CREATE OR REPLACE FUNCTION public.next_transaction_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  sequence_value bigint;
BEGIN
  sequence_value := nextval('public.transactions_number_seq');

  IF sequence_value > 999999 THEN
    RAISE EXCEPTION 'Urutan nomor transaksi sudah penuh';
  END IF;

  RETURN format(
    'BTRD25-TRX-%s-%s',
    lpad(sequence_value::text, 6, '0'),
    to_char(timezone('Asia/Jakarta', now()), 'YY')
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
  sequence_value := nextval('public.housekeeping_number_seq');

  IF sequence_value > 999999 THEN
    RAISE EXCEPTION 'Urutan nomor housekeeping sudah penuh';
  END IF;

  RETURN format(
    'BTRD25-HK-%s-%s',
    lpad(sequence_value::text, 6, '0'),
    to_char(timezone('Asia/Jakarta', now()), 'YY')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_housekeeping_transaction(
  _room_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  candidate_count integer;
  candidate_id uuid;
BEGIN
  SELECT COUNT(*)::integer
  INTO candidate_count
  FROM public.housekeeping_transaction_resolutions r
  WHERE r.room_id = _room_id
    AND EXISTS (
      SELECT 1
      FROM public.activity_logs l
      WHERE l.id = r.checkout_activity_log_id
        AND l.action = 'check_out'
        AND l.entity_id = r.transaction_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.housekeeping_history h2
          WHERE h2.room_id = _room_id
            AND h2.created_at > l.created_at
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.housekeeping_history h
      WHERE h.transaction_id = r.transaction_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.housekeeping_jobs j
      WHERE j.transaction_id = r.transaction_id
    );

  IF candidate_count = 1 THEN
    SELECT r.transaction_id
    INTO candidate_id
    FROM public.housekeeping_transaction_resolutions r
    WHERE r.room_id = _room_id
      AND EXISTS (
        SELECT 1
        FROM public.activity_logs l
        WHERE l.id = r.checkout_activity_log_id
          AND l.action = 'check_out'
          AND l.entity_id = r.transaction_id
          AND NOT EXISTS (
            SELECT 1
            FROM public.housekeeping_history h2
            WHERE h2.room_id = _room_id
              AND h2.created_at > l.created_at
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.housekeeping_history h
        WHERE h.transaction_id = r.transaction_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.housekeeping_jobs j
        WHERE j.transaction_id = r.transaction_id
      )
    ORDER BY r.created_at DESC
    LIMIT 1;

    RETURN candidate_id;
  END IF;

  IF candidate_count > 1 THEN
    RAISE EXCEPTION
      'Lebih dari satu pengaitan transaksi Housekeeping masih menunggu verifikasi';
  END IF;

  SELECT COUNT(*)::integer
  INTO candidate_count
  FROM public.transactions t
  WHERE t.room_id = _room_id
    AND t.status = 'check_out'
    AND t.checked_out_at IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.activity_logs l
      WHERE l.action = 'check_out'
        AND l.entity_id = t.id
        AND l.created_at >= t.checked_out_at
        AND NOT EXISTS (
          SELECT 1
          FROM public.housekeeping_history h2
          WHERE h2.room_id = _room_id
            AND h2.created_at > l.created_at
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.housekeeping_history h
      WHERE h.transaction_id = t.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.housekeeping_jobs j
      WHERE j.transaction_id = t.id
    );

  IF candidate_count = 0 THEN
    RAISE EXCEPTION
      'Transaksi checkout untuk pekerjaan Housekeeping tidak dapat dipastikan';
  END IF;

  IF candidate_count > 1 THEN
    RAISE EXCEPTION
      'Lebih dari satu transaksi checkout belum terhubung ke Housekeeping';
  END IF;

  SELECT t.id
  INTO candidate_id
  FROM public.transactions t
  WHERE t.room_id = _room_id
    AND t.status = 'check_out'
    AND t.checked_out_at IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.activity_logs l
      WHERE l.action = 'check_out'
        AND l.entity_id = t.id
        AND l.created_at >= t.checked_out_at
        AND NOT EXISTS (
          SELECT 1
          FROM public.housekeeping_history h2
          WHERE h2.room_id = _room_id
            AND h2.created_at > l.created_at
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.housekeeping_history h
      WHERE h.transaction_id = t.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.housekeeping_jobs j
      WHERE j.transaction_id = t.id
    );

  RETURN candidate_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_housekeeping_transaction_resolution(
  _room_id uuid,
  _transaction_id uuid,
  _checkout_activity_log_id uuid,
  _reason text,
  _evidence_ref text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  resolution_id uuid;
  pending_count integer;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'owner')
    OR public.has_employee_position(
      auth.uid(),
      array['supervisor'::public.employee_position]
    )
  ) THEN
    RAISE EXCEPTION 'Hanya Owner atau Supervisor yang dapat mengaitkan transaksi ambigu';
  END IF;

  IF length(trim(coalesce(_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Alasan pengaitan transaksi wajib diisi';
  END IF;

  IF length(trim(coalesce(_evidence_ref, ''))) = 0 THEN
    RAISE EXCEPTION 'Referensi bukti checkout wajib diisi';
  END IF;

  SELECT r.id
  INTO resolution_id
  FROM public.housekeeping_transaction_resolutions r
  WHERE r.room_id = _room_id
    AND r.transaction_id = _transaction_id
    AND r.checkout_activity_log_id = _checkout_activity_log_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.housekeeping_history h
      WHERE h.transaction_id = r.transaction_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.housekeeping_jobs j
      WHERE j.transaction_id = r.transaction_id
    )
  LIMIT 1;

  IF resolution_id IS NOT NULL THEN
    RETURN resolution_id;
  END IF;

  PERFORM 1
  FROM public.rooms r
  WHERE r.id = _room_id
    AND r.active
    AND r.status = 'dirty'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kamar tidak ditemukan atau tidak sedang DIRTY';
  END IF;

  SELECT COUNT(*)::integer
  INTO pending_count
  FROM public.housekeeping_transaction_resolutions r
  WHERE r.room_id = _room_id
    AND EXISTS (
      SELECT 1
      FROM public.activity_logs l
      WHERE l.id = r.checkout_activity_log_id
        AND l.action = 'check_out'
        AND l.entity_id = r.transaction_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.housekeeping_history h2
          WHERE h2.room_id = _room_id
            AND h2.created_at > l.created_at
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.housekeeping_history h
      WHERE h.transaction_id = r.transaction_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.housekeeping_jobs j
      WHERE j.transaction_id = r.transaction_id
    );

  IF pending_count > 0 THEN
    RAISE EXCEPTION 'Sudah ada pengaitan transaksi Housekeeping yang menunggu digunakan';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.id = _transaction_id
      AND t.room_id = _room_id
      AND t.status = 'check_out'
      AND t.checked_out_at IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.activity_logs l
        WHERE l.id = _checkout_activity_log_id
          AND l.action = 'check_out'
          AND l.entity_id = t.id
          AND l.created_at >= t.checked_out_at
          AND NOT EXISTS (
            SELECT 1
            FROM public.housekeeping_history h2
            WHERE h2.room_id = _room_id
              AND h2.created_at > l.created_at
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.housekeeping_history h
        WHERE h.transaction_id = t.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.housekeeping_jobs j
        WHERE j.transaction_id = t.id
      )
  ) THEN
    RAISE EXCEPTION 'Transaksi bukan checkout kandidat yang valid untuk kamar ini';
  END IF;

  INSERT INTO public.housekeeping_transaction_resolutions (
    room_id,
    transaction_id,
    checkout_activity_log_id,
    resolved_by,
    reason,
    evidence_ref
  )
  VALUES (
    _room_id,
    _transaction_id,
    _checkout_activity_log_id,
    auth.uid(),
    trim(_reason),
    trim(_evidence_ref)
  )
  RETURNING id INTO resolution_id;

  RETURN resolution_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.next_transaction_number()
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.next_housekeeping_number()
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.next_transaction_number()
TO postgres;

GRANT EXECUTE ON FUNCTION public.next_housekeeping_number()
TO postgres;

REVOKE ALL ON FUNCTION public.resolve_housekeeping_transaction(uuid)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.resolve_housekeeping_transaction(uuid)
TO postgres;

REVOKE ALL ON FUNCTION public.record_housekeeping_transaction_resolution(uuid, uuid, uuid, text, text)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_housekeeping_transaction_resolution(uuid, uuid, uuid, text, text)
TO authenticated;

ALTER TABLE public.transactions
  ALTER COLUMN transaction_number
  SET DEFAULT public.next_transaction_number();

CREATE OR REPLACE FUNCTION public.advance_room_cleaning(
  _room_id uuid,
  _note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_status public.room_status;
  employee_name text;
  related_transaction uuid;
  job_code text;
  new_job_id uuid;
BEGIN
  IF NOT public.can_housekeeping(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT status
  INTO current_status
  FROM public.rooms
  WHERE id = _room_id
    AND active
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kamar tidak ditemukan atau tidak aktif';
  END IF;

  IF current_status <> 'dirty' THEN
    IF current_status = 'cleaning' THEN
      RAISE EXCEPTION 'Checklist akhir wajib diselesaikan sebelum kamar SIAP';
    END IF;

    RAISE EXCEPTION 'Status kamar tidak dapat diubah';
  END IF;

  SELECT COALESCE(
    (
      SELECT e.name
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.active
      LIMIT 1
    ),
    CASE
      WHEN public.has_role(auth.uid(), 'owner') THEN 'Owner'
      ELSE 'Petugas Housekeeping'
    END
  )
  INTO employee_name;

  related_transaction := public.resolve_housekeeping_transaction(_room_id);
  job_code := public.next_housekeeping_number();

  INSERT INTO public.housekeeping_jobs (
    job_number,
    room_id,
    transaction_id,
    created_by,
    created_by_name
  )
  VALUES (
    job_code,
    _room_id,
    related_transaction,
    auth.uid(),
    employee_name
  )
  RETURNING id INTO new_job_id;

  UPDATE public.rooms
  SET status = 'cleaning'
  WHERE id = _room_id;

  INSERT INTO public.housekeeping_history (
    room_id,
    transaction_id,
    job_id,
    job_number,
    action,
    from_status,
    to_status,
    note,
    performed_by,
    performed_by_name
  )
  VALUES (
    _room_id,
    related_transaction,
    new_job_id,
    job_code,
    'start_cleaning',
    'dirty',
    'cleaning',
    trim(coalesce(_note, '')),
    auth.uid(),
    employee_name
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.advance_room_cleaning(
  _room_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.advance_room_cleaning(_room_id, '');
END;
$function$;

CREATE OR REPLACE FUNCTION public.override_room_ready(
  _room_id uuid,
  _note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_status public.room_status;
  employee_name text;
  related_transaction uuid;
  job_code text;
  new_job_id uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'owner')
    OR public.has_employee_position(
      auth.uid(),
      array['supervisor'::public.employee_position]
    )
  ) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT status
  INTO current_status
  FROM public.rooms
  WHERE id = _room_id
    AND active
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kamar tidak ditemukan atau tidak aktif';
  END IF;

  IF current_status NOT IN ('dirty', 'cleaning') THEN
    RAISE EXCEPTION 'Override READY hanya untuk kamar yang perlu atau sedang dibersihkan';
  END IF;

  SELECT COALESCE(
    (
      SELECT e.name
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.active
      LIMIT 1
    ),
    CASE
      WHEN public.has_role(auth.uid(), 'owner') THEN 'Owner'
      ELSE 'Supervisor'
    END
  )
  INTO employee_name;

  IF current_status = 'cleaning' THEN
    SELECT h.job_id, h.job_number, h.transaction_id
    INTO new_job_id, job_code, related_transaction
    FROM public.housekeeping_history h
    WHERE h.room_id = _room_id
      AND h.action = 'start_cleaning'
    ORDER BY h.created_at DESC
    LIMIT 1;
  END IF;

  IF current_status = 'dirty' THEN
    related_transaction := public.resolve_housekeeping_transaction(_room_id);
    job_code := public.next_housekeeping_number();

    INSERT INTO public.housekeeping_jobs (
      job_number,
      room_id,
      transaction_id,
      created_by,
      created_by_name
    )
    VALUES (
      job_code,
      _room_id,
      related_transaction,
      auth.uid(),
      employee_name
    )
    RETURNING id INTO new_job_id;
  END IF;

  PERFORM set_config('app.room_ready_override', 'true', true);

  UPDATE public.rooms
  SET status = 'ready'
  WHERE id = _room_id;

  INSERT INTO public.housekeeping_history (
    room_id,
    transaction_id,
    job_id,
    job_number,
    action,
    from_status,
    to_status,
    note,
    performed_by,
    performed_by_name
  )
  VALUES (
    _room_id,
    related_transaction,
    new_job_id,
    job_code,
    'override_ready',
    current_status,
    'ready',
    COALESCE(NULLIF(trim(_note), ''), 'Override READY'),
    auth.uid(),
    employee_name
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.override_room_ready(
  _room_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.override_room_ready(_room_id, '');
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_housekeeping_checklist(
  _room_id uuid,
  _checklist_id uuid,
  _towel_ok boolean,
  _mineral_water_ok boolean,
  _tissue_ok boolean,
  _ashtray_ok boolean,
  _tv_remote_ok boolean,
  _fan_ok boolean,
  _exhaust_fan_ok boolean,
  _issue_note text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_status public.room_status;
  start_history record;
  existing_checklist record;
  employee_name text;
  result_name text;
  checklist_id uuid;
  job_code text;
  item_payload jsonb;
  towel_reason_value text;
  mineral_water_reason_value text;
  tissue_reason_value text;
  ashtray_reason_value text;
  tv_remote_reason_value text;
  fan_reason_value text;
  exhaust_fan_reason_value text;
  history_note text;
BEGIN
  IF NOT public.can_housekeeping(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT id, room_id
  INTO existing_checklist
  FROM public.housekeeping_checklists
  WHERE id = _checklist_id;

  IF FOUND THEN
    IF existing_checklist.room_id <> _room_id THEN
      RAISE EXCEPTION 'Checklist idempotency key sudah digunakan untuk kamar lain';
    END IF;

    RETURN existing_checklist.id;
  END IF;

  BEGIN
    item_payload := CASE
      WHEN trim(coalesce(_issue_note, '')) = '' THEN '{}'::jsonb
      ELSE trim(_issue_note)::jsonb
    END;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Alasan checklist tidak valid';
  END;

  IF jsonb_typeof(item_payload) <> 'object' THEN
    RAISE EXCEPTION 'Alasan checklist harus berbentuk object';
  END IF;

  towel_reason_value := trim(coalesce(item_payload->>'towel', ''));
  mineral_water_reason_value := trim(coalesce(item_payload->>'mineral_water', ''));
  tissue_reason_value := trim(coalesce(item_payload->>'tissue', ''));
  ashtray_reason_value := trim(coalesce(item_payload->>'ashtray', ''));
  tv_remote_reason_value := trim(coalesce(item_payload->>'tv_remote', ''));
  fan_reason_value := trim(coalesce(item_payload->>'fan', ''));
  exhaust_fan_reason_value := trim(coalesce(item_payload->>'exhaust_fan', ''));

  IF _towel_ok IS NULL
     OR _mineral_water_ok IS NULL
     OR _tissue_ok IS NULL
     OR _ashtray_ok IS NULL
     OR _tv_remote_ok IS NULL
     OR _fan_ok IS NULL
     OR _exhaust_fan_ok IS NULL THEN
    RAISE EXCEPTION 'Semua item checklist wajib dijawab';
  END IF;

  IF NOT _towel_ok AND towel_reason_value = '' THEN
    RAISE EXCEPTION 'Alasan Handuk wajib diisi';
  END IF;

  IF NOT _mineral_water_ok AND mineral_water_reason_value = '' THEN
    RAISE EXCEPTION 'Alasan Air mineral wajib diisi';
  END IF;

  IF NOT _tissue_ok AND tissue_reason_value = '' THEN
    RAISE EXCEPTION 'Alasan Tisu wajib diisi';
  END IF;

  IF NOT _ashtray_ok AND ashtray_reason_value = '' THEN
    RAISE EXCEPTION 'Alasan Asbak wajib diisi';
  END IF;

  IF NOT _tv_remote_ok AND tv_remote_reason_value = '' THEN
    RAISE EXCEPTION 'Alasan TV + Remot wajib diisi';
  END IF;

  IF NOT _fan_ok AND fan_reason_value = '' THEN
    RAISE EXCEPTION 'Alasan Kipas Angin wajib diisi';
  END IF;

  IF NOT _exhaust_fan_ok AND exhaust_fan_reason_value = '' THEN
    RAISE EXCEPTION 'Alasan Exhaust Fan wajib diisi';
  END IF;

  SELECT status
  INTO current_status
  FROM public.rooms
  WHERE id = _room_id
    AND active
  FOR UPDATE;

  IF NOT FOUND OR current_status <> 'cleaning' THEN
    RAISE EXCEPTION 'Kamar tidak sedang dibersihkan';
  END IF;

  SELECT h.id, h.job_id, h.transaction_id, h.job_number
  INTO start_history
  FROM public.housekeeping_history h
  WHERE h.room_id = _room_id
    AND h.action = 'start_cleaning'
  ORDER BY h.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Riwayat mulai pembersihan tidak ditemukan';
  END IF;

  job_code := start_history.job_number;

  SELECT COALESCE(
    (
      SELECT e.name
      FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND e.active
      LIMIT 1
    ),
    CASE
      WHEN public.has_role(auth.uid(), 'owner') THEN 'Owner'
      ELSE 'Petugas Housekeeping'
    END
  )
  INTO employee_name;

  result_name := CASE
    WHEN _towel_ok
     AND _mineral_water_ok
     AND _tissue_ok
     AND _ashtray_ok
     AND _tv_remote_ok
     AND _fan_ok
     AND _exhaust_fan_ok
    THEN 'passed'
    ELSE 'needs_action'
  END;

  history_note := concat_ws(
    '; ',
    'Handuk: ' || CASE WHEN _towel_ok THEN 'CENTANG' ELSE 'X - ' || towel_reason_value END,
    'Air mineral: ' || CASE WHEN _mineral_water_ok THEN 'CENTANG' ELSE 'X - ' || mineral_water_reason_value END,
    'Tisu: ' || CASE WHEN _tissue_ok THEN 'CENTANG' ELSE 'X - ' || tissue_reason_value END,
    'Asbak: ' || CASE WHEN _ashtray_ok THEN 'CENTANG' ELSE 'X - ' || ashtray_reason_value END,
    'TV + Remot: ' || CASE WHEN _tv_remote_ok THEN 'CENTANG' ELSE 'X - ' || tv_remote_reason_value END,
    'Kipas Angin: ' || CASE WHEN _fan_ok THEN 'CENTANG' ELSE 'X - ' || fan_reason_value END,
    'Exhaust Fan: ' || CASE WHEN _exhaust_fan_ok THEN 'CENTANG' ELSE 'X - ' || exhaust_fan_reason_value END
  );

  history_note := COALESCE(
    NULLIF(history_note, ''),
    'Checklist akhir seluruh item sesuai'
  );

  INSERT INTO public.housekeeping_checklists (
    id,
    housekeeping_history_id,
    room_id,
    transaction_id,
    towel_ok,
    mineral_water_ok,
    tissue_ok,
    ashtray_ok,
    tv_remote_ok,
    fan_ok,
    exhaust_fan_ok,
    issue_note,
    towel_reason,
    mineral_water_reason,
    tissue_reason,
    ashtray_reason,
    tv_remote_reason,
    fan_reason,
    exhaust_fan_reason,
    result,
    performed_by,
    performed_by_name
  )
  VALUES (
    _checklist_id,
    start_history.id,
    _room_id,
    start_history.transaction_id,
    _towel_ok,
    _mineral_water_ok,
    _tissue_ok,
    _ashtray_ok,
    _tv_remote_ok,
    _fan_ok,
    _exhaust_fan_ok,
    history_note,
    towel_reason_value,
    mineral_water_reason_value,
    tissue_reason_value,
    ashtray_reason_value,
    tv_remote_reason_value,
    fan_reason_value,
    exhaust_fan_reason_value,
    result_name,
    auth.uid(),
    employee_name
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO checklist_id;

  IF checklist_id IS NULL THEN
    SELECT id
    INTO checklist_id
    FROM public.housekeeping_checklists
    WHERE housekeeping_history_id = start_history.id;

    IF checklist_id IS NULL THEN
      RAISE EXCEPTION 'Checklist gagal dicatat karena konflik id';
    END IF;

    RETURN checklist_id;
  END IF;

  UPDATE public.rooms
  SET status = 'ready'
  WHERE id = _room_id;

  INSERT INTO public.housekeeping_history (
    room_id,
    transaction_id,
    job_id,
    job_number,
    action,
    from_status,
    to_status,
    note,
    performed_by,
    performed_by_name
  )
  VALUES (
    _room_id,
    start_history.transaction_id,
    start_history.job_id,
    job_code,
    'finish_cleaning',
    'cleaning',
    'ready',
    history_note,
    auth.uid(),
    employee_name
  );

  RETURN checklist_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.next_transaction_number()
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.next_housekeeping_number()
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.advance_room_cleaning(uuid, text)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.advance_room_cleaning(uuid)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.override_room_ready(uuid, text)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.override_room_ready(uuid)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.complete_housekeeping_checklist(
  uuid, uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text
)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.advance_room_cleaning(uuid, text)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.advance_room_cleaning(uuid)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.override_room_ready(uuid, text)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.override_room_ready(uuid)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.complete_housekeeping_checklist(
  uuid, uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text
)
TO authenticated;

COMMIT;
