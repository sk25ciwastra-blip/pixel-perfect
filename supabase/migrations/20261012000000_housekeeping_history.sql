BEGIN;

DO $preflight$
DECLARE
  required_column record;
  history_exists boolean;
  validate_function oid;
  validate_trigger_count integer;
  conflicting_trigger_count integer;
BEGIN
  IF to_regclass('public.rooms') IS NULL
     OR to_regclass('public.transactions') IS NULL
     OR to_regclass('public.employees') IS NULL THEN
    RAISE EXCEPTION
      'Housekeeping migration prerequisite missing: rooms, transactions, or employees';
  END IF;

  IF to_regtype('public.room_status') IS NULL
     OR to_regtype('public.employee_position') IS NULL THEN
    RAISE EXCEPTION
      'Housekeeping migration prerequisite missing: room_status or employee_position';
  END IF;

  IF to_regprocedure('public.can_housekeeping(uuid)') IS NULL
     OR to_regprocedure(
       'public.has_employee_position(uuid,public.employee_position[])'
     ) IS NULL
     OR to_regprocedure('public.has_role(uuid,public.app_role)') IS NULL
     OR to_regprocedure('public.validate_room_transition()') IS NULL THEN
    RAISE EXCEPTION
      'Housekeeping migration prerequisite function is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rooms'
      AND column_name IN ('active', 'status')
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 2
  ) THEN
    RAISE EXCEPTION
      'Housekeeping migration prerequisite columns missing on rooms';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name IN ('user_id', 'name', 'active')
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 3
  ) THEN
    RAISE EXCEPTION
      'Housekeeping migration prerequisite columns missing on employees';
  END IF;

  history_exists := to_regclass('public.housekeeping_history') IS NOT NULL;

  IF history_exists THEN
    FOR required_column IN
      SELECT *
      FROM (VALUES
        ('id', 'uuid', 'NO'),
        ('room_id', 'uuid', 'NO'),
        ('transaction_id', 'uuid', 'YES'),
        ('action', 'text', 'NO'),
        ('from_status', 'room_status', 'NO'),
        ('to_status', 'room_status', 'NO'),
        ('note', 'text', 'NO'),
        ('performed_by', 'uuid', 'NO'),
        ('performed_by_name', 'text', 'NO'),
        ('created_at', 'timestamptz', 'NO')
      ) AS required(column_name, udt_name, is_nullable)
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'housekeeping_history'
          AND c.column_name = required_column.column_name
          AND c.udt_name = required_column.udt_name
          AND c.is_nullable = required_column.is_nullable
      ) THEN
        RAISE EXCEPTION
          'Existing housekeeping_history structure mismatch at column %',
          required_column.column_name;
      END IF;
    END LOOP;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.housekeeping_history'::regclass
        AND contype = 'p'
    ) THEN
      RAISE EXCEPTION
        'Existing housekeeping_history is missing its primary key';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conrelid = 'public.housekeeping_history'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.rooms'::regclass
        AND EXISTS (
          SELECT 1
          FROM pg_attribute a
          WHERE a.attrelid = c.conrelid
            AND a.attnum = ANY(c.conkey)
            AND a.attname = 'room_id'
        )
    ) THEN
      RAISE EXCEPTION
        'Existing housekeeping_history is missing room_id foreign key';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conrelid = 'public.housekeeping_history'::regclass
        AND c.contype = 'f'
        AND c.confrelid = 'public.transactions'::regclass
        AND EXISTS (
          SELECT 1
          FROM pg_attribute a
          WHERE a.attrelid = c.conrelid
            AND a.attnum = ANY(c.conkey)
            AND a.attname = 'transaction_id'
        )
    ) THEN
      RAISE EXCEPTION
        'Existing housekeeping_history is missing transaction_id foreign key';
    END IF;
  END IF;

  validate_function := to_regprocedure(
    'public.validate_room_transition()'
  );

  SELECT COUNT(*)
  INTO validate_trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'public.rooms'::regclass
    AND NOT tgisinternal
    AND tgfoid = validate_function;

  SELECT COUNT(*)
  INTO conflicting_trigger_count
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.rooms'::regclass
    AND NOT t.tgisinternal
    AND t.tgfoid <> validate_function
    AND pg_get_triggerdef(t.oid) ILIKE '%BEFORE UPDATE OF status%';

  IF validate_trigger_count > 1
     OR conflicting_trigger_count > 0 THEN
    RAISE EXCEPTION
      'Conflicting room status transition trigger detected; migration stopped';
  END IF;
END;
$preflight$;

CREATE TABLE IF NOT EXISTS public.housekeeping_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id),
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (
    action IN ('start_cleaning', 'finish_cleaning', 'override_ready')
  ),
  from_status public.room_status NOT NULL,
  to_status public.room_status NOT NULL,
  note text NOT NULL DEFAULT '',
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  performed_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS housekeeping_history_room_created_idx
  ON public.housekeeping_history (room_id, created_at DESC);

CREATE INDEX IF NOT EXISTS housekeeping_history_transaction_created_idx
  ON public.housekeeping_history (transaction_id, created_at DESC);

ALTER TABLE public.housekeeping_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS housekeeping_history_read
ON public.housekeeping_history;

CREATE POLICY housekeeping_history_read
ON public.housekeeping_history
FOR SELECT
TO authenticated
USING (
  public.can_housekeeping(auth.uid())
  OR public.has_employee_position(
    auth.uid(),
    array['inspector'::public.employee_position]
  )
);

GRANT SELECT
ON TABLE public.housekeeping_history
TO authenticated;

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.housekeeping_history
FROM PUBLIC, anon, authenticated;

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
  next_status public.room_status;
  action_name text;
  employee_name text;
  related_transaction uuid;
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

  IF current_status = 'dirty' THEN
    next_status := 'cleaning';
    action_name := 'start_cleaning';
  ELSIF current_status = 'cleaning' THEN
    next_status := 'ready';
    action_name := 'finish_cleaning';
  ELSE
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

  SELECT t.id
  INTO related_transaction
  FROM public.transactions t
  WHERE t.room_id = _room_id
    AND t.status = 'check_out'
  ORDER BY COALESCE(t.checked_out_at, t.updated_at, t.created_at) DESC
  LIMIT 1;

  UPDATE public.rooms
  SET status = next_status
  WHERE id = _room_id;

  INSERT INTO public.housekeeping_history (
    room_id,
    transaction_id,
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
    action_name,
    current_status,
    next_status,
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

REVOKE ALL ON FUNCTION public.advance_room_cleaning(uuid, text)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.advance_room_cleaning(uuid)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.advance_room_cleaning(uuid, text)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.advance_room_cleaning(uuid)
TO authenticated;

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

  SELECT t.id
  INTO related_transaction
  FROM public.transactions t
  WHERE t.room_id = _room_id
    AND t.status = 'check_out'
  ORDER BY COALESCE(t.checked_out_at, t.updated_at, t.created_at) DESC
  LIMIT 1;

  PERFORM set_config('app.room_ready_override', 'true', true);

  UPDATE public.rooms
  SET status = 'ready'
  WHERE id = _room_id;

  INSERT INTO public.housekeeping_history (
    room_id,
    transaction_id,
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

REVOKE ALL ON FUNCTION public.override_room_ready(uuid, text)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.override_room_ready(uuid)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.override_room_ready(uuid, text)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.override_room_ready(uuid)
TO authenticated;

DO $trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.rooms'::regclass
      AND NOT tgisinternal
      AND tgfoid = to_regprocedure('public.validate_room_transition()')
  ) THEN
    CREATE TRIGGER rooms_status_transition_guard_v1
    BEFORE UPDATE OF status
    ON public.rooms
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_room_transition();
  END IF;
END;
$trigger$;

COMMIT;
