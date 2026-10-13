-- Finance 150: align the approved Supervisor operating role.
-- This migration extends only the approved operational paths and SELECT RLS.

BEGIN;

CREATE OR REPLACE FUNCTION public.finance_is_booking_operator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.has_role(_user_id, 'owner')
    OR public.is_receptionist(_user_id)
    OR public.has_employee_position(
      _user_id,
      ARRAY['supervisor'::public.employee_position]
    );
$function$;

REVOKE ALL ON FUNCTION public.finance_is_booking_operator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_is_booking_operator(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.open_finance_cash_session(_opening_cash numeric DEFAULT 0)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  previous_session public.finance_cash_sessions;
  carried_amount numeric := 0;
  new_id uuid;
BEGIN
  IF NOT public.finance_is_booking_operator(auth.uid()) THEN
    RAISE EXCEPTION 'Hanya Owner, Receptionist, atau Supervisor yang dapat membuka sesi kas';
  END IF;

  IF _opening_cash < 0 THEN
    RAISE EXCEPTION 'Saldo awal tidak valid';
  END IF;

  SELECT * INTO previous_session
  FROM public.finance_cash_sessions s
  WHERE s.opened_by = auth.uid()
    AND s.status = 'FINAL'
  ORDER BY s.closed_at DESC NULLS LAST
  LIMIT 1;

  IF previous_session.id IS NOT NULL THEN
    SELECT COALESCE(SUM(a.amount), 0)
    INTO carried_amount
    FROM public.finance_session_allocations a
    WHERE a.session_id = previous_session.id
      AND a.allocation_type = 'DIBAWA';
  END IF;

  INSERT INTO public.finance_cash_sessions (
    opened_by,
    opening_cash,
    opening_source_session_id
  )
  VALUES (
    auth.uid(),
    CASE WHEN previous_session.id IS NOT NULL THEN carried_amount ELSE _opening_cash END,
    CASE WHEN previous_session.id IS NOT NULL THEN previous_session.id ELSE NULL END
  )
  RETURNING id INTO new_id;

  RETURN new_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Masih ada sesi kas aktif untuk pengguna ini';
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_in_booking(_transaction_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  selected_transaction record;
  selected_package record;
  actual_started_at timestamptz;
  actual_ends_at timestamptz;
  already_paid numeric(12,2);
  jakarta_now timestamp;
  scheduled_local timestamp;
BEGIN
  IF NOT public.finance_is_booking_operator(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT
    id,
    transaction_number,
    guest_id,
    room_id,
    package_id,
    status,
    price_snapshot,
    day_mode,
    scheduled_check_in
  INTO selected_transaction
  FROM public.transactions
  WHERE id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;
  IF selected_transaction.status <> 'booking' THEN RAISE EXCEPTION 'Transaksi tidak dapat di-check-in'; END IF;
  IF selected_transaction.guest_id IS NULL OR selected_transaction.room_id IS NULL OR selected_transaction.package_id IS NULL THEN
    RAISE EXCEPTION 'Data transaksi tidak lengkap';
  END IF;
  IF selected_transaction.scheduled_check_in IS NULL THEN RAISE EXCEPTION 'Jadwal check-in booking belum ditentukan'; END IF;
  IF selected_transaction.day_mode IS NULL OR selected_transaction.day_mode NOT IN ('weekday', 'weekend') THEN
    RAISE EXCEPTION 'Weekday/Weekend transaksi belum ditentukan';
  END IF;
  IF selected_transaction.price_snapshot IS NULL OR selected_transaction.price_snapshot < 0 THEN
    RAISE EXCEPTION 'Harga transaksi belum tersimpan';
  END IF;

  SELECT p.id, p.name, p.time_mode
  INTO selected_package
  FROM public.packages p
  WHERE p.id = selected_transaction.package_id
    AND p.active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paket tidak tersedia'; END IF;

  jakarta_now := now() AT TIME ZONE 'Asia/Jakarta';
  scheduled_local := selected_transaction.scheduled_check_in AT TIME ZONE 'Asia/Jakarta';
  IF jakarta_now::date < scheduled_local::date THEN
    RAISE EXCEPTION 'Belum waktunya check-in. Jadwal booking belum tiba';
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO already_paid
  FROM public.payments
  WHERE transaction_id = selected_transaction.id;
  IF already_paid < selected_transaction.price_snapshot THEN RAISE EXCEPTION 'Sisa pembayaran harus dilunasi sebelum check-in'; END IF;
  IF already_paid > selected_transaction.price_snapshot THEN RAISE EXCEPTION 'Total pembayaran melebihi tagihan transaksi'; END IF;

  SELECT t.started_at, t.ends_at
  INTO actual_started_at, actual_ends_at
  FROM public.calculate_package_stay_times(selected_transaction.package_id, now()) t;

  UPDATE public.rooms
  SET status = 'occupied'
  WHERE id = selected_transaction.room_id
    AND status = 'ready'
    AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kamar tidak tersedia'; END IF;

  UPDATE public.transactions
  SET status = 'check_in', started_at = actual_started_at, ends_at = actual_ends_at
  WHERE id = selected_transaction.id;

  RETURN selected_transaction.transaction_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_reservation(
  _mode text,
  _room_id uuid,
  _package_id uuid,
  _name text,
  _phone text,
  _address text,
  _amount numeric,
  _method text,
  _day_mode text,
  _scheduled_check_in timestamptz DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL,
  _session_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  selected_price numeric(12,2);
  selected_pricing_group text;
  selected_guest uuid;
  selected_transaction uuid;
  number text;
  actual_started_at timestamptz;
  actual_ends_at timestamptz;
  planned_check_in timestamptz;
  planned_check_out timestamptz;
  authoritative_day_mode text;
  operational_date date;
  request_fingerprint text;
  existing_idempotency public.finance_reservation_idempotency;
BEGIN
  IF _idempotency_key IS NULL THEN RAISE EXCEPTION 'Idempotency key booking wajib diisi'; END IF;
  IF NOT public.finance_is_booking_operator(auth.uid()) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;

  request_fingerprint := md5(jsonb_build_object(
    'mode', _mode, 'room_id', _room_id, 'package_id', _package_id,
    'name', trim(_name), 'phone', _phone, 'address', trim(_address),
    'amount', _amount, 'method', _method, 'day_mode', _day_mode,
    'scheduled_check_in', _scheduled_check_in, 'session_id', _session_id
  )::text);

  INSERT INTO public.finance_reservation_idempotency
    (idempotency_key, request_fingerprint, created_by)
  VALUES (_idempotency_key, request_fingerprint, auth.uid())
  ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT * INTO existing_idempotency
  FROM public.finance_reservation_idempotency
  WHERE idempotency_key = _idempotency_key
  FOR UPDATE;

  IF existing_idempotency.request_fingerprint <> request_fingerprint THEN
    RAISE EXCEPTION 'Idempotency key booking sudah digunakan dengan payload berbeda';
  END IF;
  IF existing_idempotency.transaction_id IS NOT NULL THEN RETURN existing_idempotency.transaction_number; END IF;

  IF _mode IS NULL OR _mode NOT IN ('booking', 'check_in') THEN RAISE EXCEPTION 'Jenis transaksi tidak valid'; END IF;
  IF _method IS NULL OR _method NOT IN ('Cash', 'QRIS', 'Transfer') THEN RAISE EXCEPTION 'Metode pembayaran tidak valid'; END IF;
  IF length(trim(coalesce(_name, ''))) NOT BETWEEN 1 AND 100 OR coalesce(_phone, '') !~ '^[0-9+]{8,16}$' OR length(coalesce(_address, '')) > 500 THEN
    RAISE EXCEPTION 'Data tamu tidak valid';
  END IF;
  IF _mode = 'booking' AND _scheduled_check_in IS NULL THEN RAISE EXCEPTION 'Tanggal dan jam check-in wajib dipilih untuk booking'; END IF;

  IF _mode = 'booking' THEN
    SELECT t.scheduled_check_in, t.scheduled_check_out
    INTO planned_check_in, planned_check_out
    FROM public.calculate_scheduled_booking_times(_package_id, _scheduled_check_in) t;
    IF planned_check_in IS NULL OR planned_check_out IS NULL OR planned_check_out <= planned_check_in THEN RAISE EXCEPTION 'Jadwal booking tidak valid'; END IF;
    operational_date := (planned_check_in AT TIME ZONE 'Asia/Jakarta')::date;
  ELSE
    SELECT t.started_at, t.ends_at
    INTO actual_started_at, actual_ends_at
    FROM public.calculate_package_stay_times(_package_id, now()) t;
    IF actual_started_at IS NULL OR actual_ends_at IS NULL OR actual_ends_at <= actual_started_at THEN RAISE EXCEPTION 'Waktu check-in tidak valid'; END IF;
    operational_date := (actual_started_at AT TIME ZONE 'Asia/Jakarta')::date;
  END IF;

  authoritative_day_mode := public.get_operational_day_mode(operational_date);
  IF authoritative_day_mode IS NULL OR authoritative_day_mode NOT IN ('weekday', 'weekend') THEN RAISE EXCEPTION 'Jenis hari operasional tidak valid'; END IF;

  SELECT rt.pricing_group,
         CASE WHEN authoritative_day_mode = 'weekday' THEN pr.weekday_price ELSE pr.weekend_price END
  INTO selected_pricing_group, selected_price
  FROM public.rooms r
  JOIN public.room_types rt ON rt.id = r.room_type_id
  JOIN public.packages p ON p.id = _package_id AND p.active
  JOIN public.package_room_type_prices pr ON pr.package_id = p.id AND pr.pricing_group = rt.pricing_group
  WHERE r.id = _room_id;
  IF NOT FOUND OR selected_pricing_group IS NULL OR selected_price IS NULL THEN RAISE EXCEPTION 'Harga resmi untuk kombinasi kamar dan paket tidak tersedia'; END IF;
  IF _amount IS NULL OR _amount < 0 OR _amount > selected_price THEN RAISE EXCEPTION 'Nominal pembayaran tidak valid'; END IF;
  IF _mode = 'check_in' AND _amount <> selected_price THEN RAISE EXCEPTION 'Check-in langsung harus dibayar lunas'; END IF;

  PERFORM 1 FROM public.rooms WHERE id = _room_id AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kamar tidak aktif atau tidak tersedia'; END IF;
  IF _mode = 'booking' THEN
    IF EXISTS (
      SELECT 1 FROM public.transactions tr
      WHERE tr.room_id = _room_id AND tr.status = 'booking'
        AND tr.scheduled_check_in IS NOT NULL AND tr.scheduled_check_out IS NOT NULL
        AND tr.scheduled_check_in < planned_check_out AND tr.scheduled_check_out > planned_check_in
    ) THEN RAISE EXCEPTION 'Jadwal kamar bentrok dengan booking lain'; END IF;
  ELSE
    UPDATE public.rooms SET status = 'occupied' WHERE id = _room_id AND status = 'ready' AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Kamar tidak tersedia untuk check-in'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.transactions tr
      WHERE tr.room_id = _room_id AND tr.status = 'booking'
        AND tr.scheduled_check_in IS NOT NULL AND tr.scheduled_check_out IS NOT NULL
        AND tr.scheduled_check_in < actual_ends_at AND tr.scheduled_check_out > actual_started_at
    ) THEN RAISE EXCEPTION 'Waktu check-in bentrok dengan booking terjadwal'; END IF;
  END IF;

  SELECT id INTO selected_guest FROM public.guests WHERE phone = _phone;
  IF selected_guest IS NULL THEN
    IF length(trim(coalesce(_address, ''))) = 0 THEN RAISE EXCEPTION 'Alamat wajib diisi untuk tamu baru'; END IF;
    INSERT INTO public.guests (full_name, address, phone)
    VALUES (trim(_name), trim(_address), _phone)
    RETURNING id INTO selected_guest;
  END IF;

  INSERT INTO public.transactions (
    guest_id, room_id, package_id, status, created_by, price_snapshot,
    day_mode, scheduled_check_in, scheduled_check_out, started_at, ends_at
  ) VALUES (
    selected_guest, _room_id, _package_id, _mode::public.transaction_status,
    auth.uid(), selected_price, authoritative_day_mode,
    CASE WHEN _mode = 'booking' THEN planned_check_in END,
    CASE WHEN _mode = 'booking' THEN planned_check_out END,
    CASE WHEN _mode = 'check_in' THEN actual_started_at END,
    CASE WHEN _mode = 'check_in' THEN actual_ends_at END
  ) RETURNING id, transaction_number INTO selected_transaction, number;

  IF _amount > 0 THEN
    INSERT INTO public.payments (
      transaction_id, amount, method, kind, recorded_by, idempotency_key, cash_session_id
    ) VALUES (
      selected_transaction, _amount, _method,
      CASE WHEN _mode = 'booking' THEN 'dp' ELSE 'payment' END,
      auth.uid(), _idempotency_key, _session_id
    );
  END IF;

  UPDATE public.finance_reservation_idempotency
  SET transaction_id = selected_transaction, transaction_number = number
  WHERE idempotency_key = _idempotency_key;
  RETURN number;
END;
$function$;

-- Operational read access for the approved Supervisor role.
DROP POLICY IF EXISTS guests_supervisor_read ON public.guests;
CREATE POLICY guests_supervisor_read ON public.guests
FOR SELECT TO authenticated
USING (public.has_employee_position(auth.uid(), ARRAY['supervisor'::public.employee_position]));

DROP POLICY IF EXISTS transactions_supervisor_read ON public.transactions;
CREATE POLICY transactions_supervisor_read ON public.transactions
FOR SELECT TO authenticated
USING (public.has_employee_position(auth.uid(), ARRAY['supervisor'::public.employee_position]));

DROP POLICY IF EXISTS payments_supervisor_read ON public.payments;
CREATE POLICY payments_supervisor_read ON public.payments
FOR SELECT TO authenticated
USING (public.has_employee_position(auth.uid(), ARRAY['supervisor'::public.employee_position]));

DROP POLICY IF EXISTS employees_supervisor_read ON public.employees;
CREATE POLICY employees_supervisor_read ON public.employees
FOR SELECT TO authenticated
USING (public.has_employee_position(auth.uid(), ARRAY['supervisor'::public.employee_position]));

DROP POLICY IF EXISTS finance_bank_accounts_supervisor_read ON public.finance_bank_accounts;
CREATE POLICY finance_bank_accounts_supervisor_read ON public.finance_bank_accounts
FOR SELECT TO authenticated
USING (public.has_employee_position(auth.uid(), ARRAY['supervisor'::public.employee_position]));

-- Supervisor operates through the approved SECURITY DEFINER RPCs; do not grant
-- direct guest or transaction mutation through the broader can_frontdesk helper.
DROP POLICY IF EXISTS guests_write ON public.guests;
CREATE POLICY guests_write ON public.guests
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.is_receptionist(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.is_receptionist(auth.uid()));

DROP POLICY IF EXISTS transactions_insert ON public.transactions;
CREATE POLICY transactions_insert ON public.transactions
FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'owner') OR public.is_receptionist(auth.uid()))
  AND created_by = auth.uid()
);

GRANT EXECUTE ON FUNCTION public.create_reservation(text, uuid, uuid, text, text, text, numeric, text, text, timestamptz, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_finance_cash_session(numeric) TO authenticated;

COMMIT;
