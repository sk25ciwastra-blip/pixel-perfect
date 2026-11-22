-- Baturaden 25 Homestay / No.5: disposable PG17 positive-path fixture.
-- THESE ARE SYNTHETIC TABLES/ROLES, NOT A CLONE OF LOVABLE SCHEMA.
-- The 5 production RPC BODIES appended below are exact read-only snapshots
-- of current Lovable Cloud as of 2026-11-22; do not replay into production.
-- No customer data, API key, password, external connection, or Cloud seq.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$authuid$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $authuid$;

CREATE TYPE public.app_role AS ENUM ('owner','employee');
CREATE TYPE public.employee_position AS ENUM ('receptionist','supervisor','housekeeping','trainee');
CREATE TYPE public.room_status AS ENUM ('ready','occupied','dirty','cleaning','maintenance');
CREATE TYPE public.transaction_status AS ENUM ('booking','check_in','check_out','cancelled');

CREATE TABLE public.employees (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid UNIQUE NOT NULL,
 name text NOT NULL,
 active boolean NOT NULL DEFAULT true,
 position public.employee_position NOT NULL
);
CREATE TABLE public.rooms (
 id uuid PRIMARY KEY, room_number text NOT NULL, active boolean NOT NULL,
 status public.room_status NOT NULL
);
CREATE TABLE public.packages (
 id uuid PRIMARY KEY, name text NOT NULL,
 active boolean NOT NULL DEFAULT true, time_mode text NOT NULL,
 duration_minutes integer
);
CREATE TABLE public.guests (
 id uuid PRIMARY KEY, full_name text NOT NULL
);
CREATE TABLE public.finance_cash_sessions (
 id uuid PRIMARY KEY, opened_by uuid NOT NULL, opening_cash numeric NOT NULL,
 status text NOT NULL CHECK(status IN('OPEN','FINAL'))
);
CREATE TABLE public.transactions (
 id uuid PRIMARY KEY,
 transaction_number text UNIQUE NOT NULL,
 guest_id uuid REFERENCES public.guests(id),
 room_id uuid NOT NULL REFERENCES public.rooms(id),
 package_id uuid REFERENCES public.packages(id),
 status public.transaction_status NOT NULL,
 created_by uuid,
 price_snapshot numeric NOT NULL CHECK(price_snapshot>=0),
 day_mode text,
 scheduled_check_in timestamptz, scheduled_check_out timestamptz,
 started_at timestamptz, ends_at timestamptz, checked_out_at timestamptz
);
CREATE TABLE public.payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 transaction_id uuid NOT NULL REFERENCES public.transactions(id),
 amount numeric NOT NULL CHECK(amount>0),
 method text NOT NULL, kind text NOT NULL,
 recorded_by uuid NOT NULL,
 idempotency_key uuid UNIQUE,
 cash_session_id uuid NOT NULL REFERENCES public.finance_cash_sessions(id),
 commission_amount numeric NOT NULL DEFAULT 0
);
CREATE TABLE public.finance_charge_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 transaction_id uuid REFERENCES public.transactions(id), amount numeric NOT NULL
);
CREATE TABLE public.finance_refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 transaction_id uuid REFERENCES public.transactions(id), amount numeric NOT NULL
);
CREATE TABLE public.activity_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid,action text,entity_type text,entity_id uuid,
 description text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.housekeeping_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 job_number text NOT NULL UNIQUE,
 room_id uuid NOT NULL REFERENCES public.rooms(id),
 transaction_id uuid REFERENCES public.transactions(id),
 created_by uuid NOT NULL, created_by_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.housekeeping_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 room_id uuid NOT NULL REFERENCES public.rooms(id),
 transaction_id uuid REFERENCES public.transactions(id),
 job_id uuid REFERENCES public.housekeeping_jobs(id),
 job_number text,
 action text NOT NULL,
 from_status public.room_status,
 to_status public.room_status,
 note text,performed_by uuid,performed_by_name text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.housekeeping_checklists (
 id uuid PRIMARY KEY,
 housekeeping_history_id uuid NOT NULL UNIQUE REFERENCES public.housekeeping_history(id),
 room_id uuid NOT NULL REFERENCES public.rooms(id),
 transaction_id uuid REFERENCES public.transactions(id),
 towel_ok boolean, mineral_water_ok boolean, tissue_ok boolean,
 ashtray_ok boolean, tv_remote_ok boolean, fan_ok boolean, exhaust_fan_ok boolean,
 issue_note text,
 towel_reason text,mineral_water_reason text,tissue_reason text,ashtray_reason text,
 tv_remote_reason text,fan_reason text,exhaust_fan_reason text,
 result text NOT NULL,
 performed_by uuid,performed_by_name text,
 created_at timestamptz NOT NULL DEFAULT now()
);

-- Synthetic identity/clock helpers only. Production uses more complex role
-- checks, training state and package time rules that have separate PASS tests.
CREATE FUNCTION public.has_role(actor uuid, wanted public.app_role)
RETURNS boolean LANGUAGE sql STABLE AS
$role$ SELECT wanted='owner'::public.app_role AND actor='00000000-0000-4000-8000-000000000001'::uuid $role$;
CREATE FUNCTION public.is_receptionist(actor uuid)
RETURNS boolean LANGUAGE sql STABLE AS
$role$ SELECT actor='00000000-0000-4000-8000-000000000002'::uuid $role$;
CREATE FUNCTION public.has_employee_position(actor uuid,wanted public.employee_position[])
RETURNS boolean LANGUAGE sql STABLE AS
$role$ SELECT EXISTS(SELECT 1 FROM public.employees e WHERE e.user_id=actor AND e.active AND e.position=ANY(wanted)) $role$;
CREATE FUNCTION public.finance_is_booking_operator(actor uuid)
RETURNS boolean LANGUAGE sql STABLE AS
$role$ SELECT public.has_role(actor,'owner'::public.app_role) OR public.is_receptionist(actor) $role$;
CREATE FUNCTION public.can_frontdesk(actor uuid)
RETURNS boolean LANGUAGE sql STABLE AS
$role$ SELECT public.finance_is_booking_operator(actor) $role$;
CREATE FUNCTION public.can_housekeeping(actor uuid)
RETURNS boolean LANGUAGE sql STABLE AS
$role$ SELECT public.has_role(actor,'owner'::public.app_role) OR EXISTS(
 SELECT 1 FROM public.employees e WHERE e.user_id=actor AND e.active AND e.position='housekeeping'
) $role$;
CREATE FUNCTION public.calculate_package_stay_times(pkg uuid,requested timestamptz)
RETURNS TABLE(started_at timestamptz,ends_at timestamptz)
LANGUAGE sql STABLE AS $time$
 SELECT requested, requested+make_interval(mins=>(SELECT duration_minutes FROM public.packages WHERE id=pkg))
$time$;
CREATE FUNCTION public.resolve_housekeeping_transaction(room uuid)
RETURNS uuid LANGUAGE sql STABLE AS $hktrx$
 SELECT t.id FROM public.transactions t WHERE t.room_id=room AND t.status='check_out'
 ORDER BY t.checked_out_at DESC LIMIT 1
$hktrx$;
CREATE SEQUENCE public.fixture_housekeeping_number_seq START 1;
CREATE FUNCTION public.next_housekeeping_number()
RETURNS text LANGUAGE sql VOLATILE AS $hkseq$
 SELECT 'B25HK-'||lpad(nextval('public.fixture_housekeeping_number_seq')::text,6,'0')
$hkseq$;

-- Five exact Cloud function definitions follow. Only helper implementations
-- and tables are synthetic; no production migrations or extra triggers.

-- Cloud RPC advance_room_cleaning(uuid,text); prosrc MD5 0eb3730060a3a005bfec097f42ae3810
CREATE OR REPLACE FUNCTION public.advance_room_cleaning(_room_id uuid, _note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

-- Cloud RPC check_in_booking(uuid); prosrc MD5 fb29b1e4d72c71f5895ef8a1a1767387
CREATE OR REPLACE FUNCTION public.check_in_booking(_transaction_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  selected_transaction record;
  selected_package record;
  actual_started_at timestamptz;
  actual_ends_at timestamptz;
  already_paid numeric(12,2);
  server_now timestamptz := now();
  is_duration_package boolean;
BEGIN
  IF NOT public.finance_is_booking_operator(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT
    t.id,
    t.transaction_number,
    t.guest_id,
    t.room_id,
    t.package_id,
    t.status,
    t.price_snapshot,
    t.day_mode,
    t.scheduled_check_in,
    t.scheduled_check_out
  INTO selected_transaction
  FROM public.transactions t
  WHERE t.id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;
  IF selected_transaction.status <> 'booking' THEN
    RAISE EXCEPTION 'Transaksi tidak dapat di-check-in';
  END IF;
  IF selected_transaction.guest_id IS NULL
     OR selected_transaction.room_id IS NULL
     OR selected_transaction.package_id IS NULL THEN
    RAISE EXCEPTION 'Data transaksi tidak lengkap';
  END IF;
  IF selected_transaction.scheduled_check_in IS NULL
     OR selected_transaction.scheduled_check_out IS NULL
     OR selected_transaction.scheduled_check_out <= selected_transaction.scheduled_check_in THEN
    RAISE EXCEPTION 'Jadwal check-in/check-out booking belum valid';
  END IF;
  IF selected_transaction.day_mode IS NULL
     OR selected_transaction.day_mode NOT IN ('weekday', 'weekend') THEN
    RAISE EXCEPTION 'Weekday/Weekend transaksi belum ditentukan';
  END IF;
  IF selected_transaction.price_snapshot IS NULL
     OR selected_transaction.price_snapshot < 0 THEN
    RAISE EXCEPTION 'Harga transaksi belum tersimpan';
  END IF;

  SELECT p.id, p.name, p.time_mode, p.duration_minutes
  INTO selected_package
  FROM public.packages p
  WHERE p.id = selected_transaction.package_id
    AND p.active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paket tidak tersedia'; END IF;

  -- The boundary is strict: at scheduled checkout, the booking is expired.
  IF server_now >= selected_transaction.scheduled_check_out THEN
    RAISE EXCEPTION 'Booking sudah kedaluwarsa pada batas checkout';
  END IF;

  is_duration_package := selected_package.time_mode IN ('duration', 'duration_midnight_cap');
  actual_started_at := server_now;

  IF is_duration_package THEN
    -- Owner correction #46: late arrivals cannot extend scheduled checkout.
    -- Earlier package limits and midnight caps still take precedence.
    SELECT LEAST(t.ends_at, selected_transaction.scheduled_check_out)
    INTO actual_ends_at
    FROM public.calculate_package_stay_times(selected_transaction.package_id, server_now) t;
  ELSE
    -- Pagi, Malam, Harian, and Mingguan keep their approved package rules.
    SELECT t.ends_at
    INTO actual_ends_at
    FROM public.calculate_package_stay_times(selected_transaction.package_id, server_now) t;

    -- Fixed-window arrivals must belong to the booked WIB slot.
    IF selected_package.time_mode = 'fixed_window'
       AND actual_ends_at IS DISTINCT FROM selected_transaction.scheduled_check_out THEN
      RAISE EXCEPTION 'Check-in harus berada pada slot waktu booking yang sama';
    END IF;
  END IF;

  IF actual_ends_at IS NULL OR actual_ends_at <= actual_started_at THEN
    RAISE EXCEPTION 'Waktu checkout hasil check-in tidak valid';
  END IF;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO already_paid
  FROM public.payments p
  WHERE p.transaction_id = selected_transaction.id;
  IF already_paid < selected_transaction.price_snapshot THEN
    RAISE EXCEPTION 'Sisa pembayaran harus dilunasi sebelum check-in';
  END IF;
  IF already_paid > selected_transaction.price_snapshot THEN
    RAISE EXCEPTION 'Total pembayaran melebihi tagihan transaksi';
  END IF;

  -- Lock the physical room before checking intervals. This serializes two
  -- operators attempting to check in the same room.
  PERFORM 1
  FROM public.rooms r
  WHERE r.id = selected_transaction.room_id
    AND r.active
    AND r.status = 'ready'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kamar tidak tersedia'; END IF;

  -- A current stay or a following booking may not overlap the actual stay
  -- that this check-in would create.
  IF EXISTS (
    SELECT 1
    FROM public.transactions tr
    WHERE tr.room_id = selected_transaction.room_id
      AND tr.id <> selected_transaction.id
      AND (
        (tr.status = 'booking'
          AND tr.scheduled_check_in IS NOT NULL
          AND tr.scheduled_check_out IS NOT NULL
          AND tr.scheduled_check_in < actual_ends_at
          AND tr.scheduled_check_out > actual_started_at)
        OR
        (tr.status = 'check_in'
          AND tr.started_at IS NOT NULL
          AND tr.ends_at IS NOT NULL
          AND tr.started_at < actual_ends_at
          AND tr.ends_at > actual_started_at)
      )
  ) THEN
    RAISE EXCEPTION 'Jadwal kamar bentrok dengan transaksi lain';
  END IF;

  UPDATE public.rooms
  SET status = 'occupied'
  WHERE id = selected_transaction.room_id
    AND status = 'ready'
    AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kamar tidak tersedia'; END IF;

  UPDATE public.transactions
  SET status = 'check_in',
      started_at = actual_started_at,
      ends_at = actual_ends_at
  WHERE id = selected_transaction.id
    AND status = 'booking';
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking sudah diproses oleh operator lain'; END IF;

  RETURN selected_transaction.transaction_number;
END;
$function$;

-- Cloud RPC check_out_transaction(uuid); prosrc MD5 2ab65aa2ebd66574f858dc3ff54e7c7f
CREATE OR REPLACE FUNCTION public.check_out_transaction(_transaction_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  selected_transaction record;
  base_amount numeric; charge_amount numeric;
  gross_paid numeric; refunded_amount numeric;
  net_paid numeric; settlement_due numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.can_frontdesk(auth.uid()),FALSE) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;
  SELECT id,transaction_number,room_id,status,price_snapshot
    INTO selected_transaction FROM public.transactions
    WHERE id=_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;
  IF selected_transaction.status <> 'check_in' THEN
    RAISE EXCEPTION 'Hanya transaksi CHECK-IN yang dapat di-check-out';
  END IF;
  IF selected_transaction.price_snapshot IS NULL
     OR selected_transaction.price_snapshot < 0 THEN
    RAISE EXCEPTION 'Tagihan transaksi tidak valid untuk Check-out';
  END IF;

  base_amount:=selected_transaction.price_snapshot;
  SELECT COALESCE(SUM(c.amount),0) INTO charge_amount
    FROM public.finance_charge_events c WHERE c.transaction_id=selected_transaction.id;
  SELECT COALESCE(SUM(p.amount),0) INTO gross_paid
    FROM public.payments p WHERE p.transaction_id=selected_transaction.id;
  SELECT COALESCE(SUM(r.amount),0) INTO refunded_amount
    FROM public.finance_refunds r WHERE r.transaction_id=selected_transaction.id;
  net_paid:=gross_paid-refunded_amount;
  settlement_due:=base_amount+charge_amount;
  IF net_paid<settlement_due THEN
    RAISE EXCEPTION 'Check-out ditolak: sisa settlement masih %',settlement_due-net_paid;
  END IF;
  IF net_paid>settlement_due THEN
    RAISE EXCEPTION 'Check-out ditolak: settlement bersih % melebihi kewajiban %',net_paid,settlement_due;
  END IF;

  UPDATE public.rooms SET status='dirty'
    WHERE id=selected_transaction.room_id AND status='occupied';
  IF NOT FOUND THEN RAISE EXCEPTION 'Kamar transaksi tidak berstatus TERISI'; END IF;
  UPDATE public.transactions SET status='check_out',checked_out_at=now()
    WHERE id=selected_transaction.id AND status='check_in';
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi sudah diproses oleh operator lain'; END IF;
  INSERT INTO public.activity_logs (user_id,action,entity_type,entity_id,description)
  VALUES (auth.uid(),'check_out','transaction',selected_transaction.id,
          'Check-out transaksi '||selected_transaction.transaction_number);
  RETURN selected_transaction.transaction_number;
END;
$function$;

-- Cloud RPC complete_housekeeping_checklist(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,text); prosrc MD5 8c9dbcabf70646f89c047291cd81c0f2
CREATE OR REPLACE FUNCTION public.complete_housekeeping_checklist(_room_id uuid, _checklist_id uuid, _towel_ok boolean, _mineral_water_ok boolean, _tissue_ok boolean, _ashtray_ok boolean, _tv_remote_ok boolean, _fan_ok boolean, _exhaust_fan_ok boolean, _issue_note text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kamar tidak sedang dibersihkan';
  END IF;

  -- Another request may have committed this exact key while we waited for
  -- the room lock. Recheck before rejecting the now-READY room.
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

  IF current_status <> 'cleaning' THEN
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

-- Cloud RPC record_transaction_payment(uuid,numeric,text,uuid,uuid); prosrc MD5 e9e88c3e70c76450ecc89744adc78471
CREATE OR REPLACE FUNCTION public.record_transaction_payment(_transaction_id uuid, _amount numeric, _method text, _idempotency_key uuid, _session_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  selected_transaction record;
  existing_payment record;
  already_paid numeric;
  remaining_amount numeric;
  new_payment_id uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'owner')
    OR public.is_receptionist(auth.uid())
    OR public.has_employee_position(auth.uid(), ARRAY['supervisor'::public.employee_position])
  ) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  IF _idempotency_key IS NULL
     OR _amount IS NULL
     OR _amount <= 0
     OR _method NOT IN ('Cash', 'QRIS', 'Transfer') THEN
    RAISE EXCEPTION 'Data pembayaran tidak valid';
  END IF;

  SELECT p.id, p.transaction_id, p.amount, p.method
  INTO existing_payment
  FROM public.payments p
  WHERE p.idempotency_key = _idempotency_key;

  IF existing_payment.id IS NOT NULL THEN
    IF existing_payment.transaction_id <> _transaction_id
       OR existing_payment.amount <> _amount
       OR existing_payment.method <> _method THEN
      RAISE EXCEPTION 'Idempotency key sudah digunakan dengan payload berbeda';
    END IF;
    RETURN existing_payment.id;
  END IF;

  SELECT * INTO selected_transaction
  FROM public.transactions
  WHERE id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND OR selected_transaction.status = 'cancelled' THEN
    RAISE EXCEPTION 'Transaksi tidak dapat menerima pembayaran';
  END IF;

  SELECT p.id, p.transaction_id, p.amount, p.method
  INTO existing_payment
  FROM public.payments p
  WHERE p.idempotency_key = _idempotency_key;

  IF existing_payment.id IS NOT NULL THEN
    IF existing_payment.transaction_id <> _transaction_id
       OR existing_payment.amount <> _amount
       OR existing_payment.method <> _method THEN
      RAISE EXCEPTION 'Idempotency key sudah digunakan dengan payload berbeda';
    END IF;
    RETURN existing_payment.id;
  END IF;

  already_paid := COALESCE((SELECT SUM(p.amount) FROM public.payments p WHERE p.transaction_id = _transaction_id), 0);
  remaining_amount := selected_transaction.price_snapshot - already_paid;

  IF remaining_amount <= 0 OR _amount > remaining_amount THEN
    RAISE EXCEPTION 'Nominal pembayaran melebihi sisa tagihan';
  END IF;

  INSERT INTO public.payments (
    transaction_id,
    amount,
    method,
    kind,
    recorded_by,
    idempotency_key,
    cash_session_id
  )
  VALUES (
    _transaction_id,
    _amount,
    _method,
    'payment',
    auth.uid(),
    _idempotency_key,
    _session_id
  )
  ON CONFLICT (idempotency_key)
  WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO new_payment_id;

  IF new_payment_id IS NULL THEN
    SELECT p.id, p.transaction_id, p.amount, p.method
    INTO existing_payment
    FROM public.payments p
    WHERE p.idempotency_key = _idempotency_key;
    IF existing_payment.transaction_id <> _transaction_id
       OR existing_payment.amount <> _amount
       OR existing_payment.method <> _method THEN
      RAISE EXCEPTION 'Idempotency key sudah digunakan dengan payload berbeda';
    END IF;
    RETURN existing_payment.id;
  END IF;

  RETURN new_payment_id;
END;
$function$;
