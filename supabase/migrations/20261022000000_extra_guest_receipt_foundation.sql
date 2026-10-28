BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.transactions') IS NULL
     OR to_regclass('public.payments') IS NULL
     OR to_regclass('public.guests') IS NULL
     OR to_regclass('public.finance_reservation_idempotency') IS NULL THEN
    RAISE EXCEPTION 'Extra Guest/Receipt requires existing Booking and Finance foundation';
  END IF;
  IF to_regprocedure('public.finance_is_booking_operator(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Approved booking operator contract is missing';
  END IF;
END
$preflight$;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS base_price_snapshot numeric(12,2),
  ADD COLUMN IF NOT EXISTS guest_count integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS extra_guest_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_guest_unit_price numeric(12,2) NOT NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS extra_guest_charge numeric(12,2) NOT NULL DEFAULT 0;

DO $transaction_extra_guest_constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.transactions'::regclass AND conname='transactions_guest_count_valid') THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_guest_count_valid CHECK (guest_count >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.transactions'::regclass AND conname='transactions_extra_guest_count_valid') THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_extra_guest_count_valid CHECK (extra_guest_count = GREATEST(guest_count - 2, 0));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.transactions'::regclass AND conname='transactions_extra_guest_charge_valid') THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_extra_guest_charge_valid CHECK (extra_guest_unit_price >= 0 AND extra_guest_charge = extra_guest_count * extra_guest_unit_price);
  END IF;
END
$transaction_extra_guest_constraints$;

CREATE TABLE IF NOT EXISTS public.receipt_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_kind text NOT NULL CHECK (template_kind IN ('BOOKING','WALK_IN')),
  version integer NOT NULL CHECK (version > 0),
  preset text NOT NULL CHECK (preset IN ('COMPACT','STANDARD','DETAILED','PREMIUM_MINIMAL')),
  language text NOT NULL DEFAULT 'en' CHECK (language = 'en'),
  paper_width_mm numeric(5,2) NOT NULL DEFAULT 58 CHECK (paper_width_mm = 58),
  blocks jsonb NOT NULL CHECK (jsonb_typeof(blocks) = 'array'),
  header_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  footer_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (template_kind, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS receipt_template_one_active_kind
  ON public.receipt_template_versions(template_kind) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL UNIQUE REFERENCES public.payments(id),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  receipt_kind text NOT NULL CHECK (receipt_kind IN ('DEPOSIT','PARTIAL_PAYMENT','FINAL_PAYMENT','ADDITIONAL_PAYMENT')),
  template_version_id uuid REFERENCES public.receipt_template_versions(id),
  template_snapshot jsonb NOT NULL,
  receipt_snapshot jsonb NOT NULL,
  payment_amount numeric(12,2) NOT NULL CHECK (payment_amount > 0),
  total_paid_at_issue numeric(12,2) NOT NULL CHECK (total_paid_at_issue >= 0),
  outstanding_at_issue numeric(12,2) NOT NULL CHECK (outstanding_at_issue >= 0),
  payment_status_at_issue text NOT NULL CHECK (payment_status_at_issue IN ('PAID IN FULL','BALANCE DUE')),
  served_by uuid NOT NULL REFERENCES auth.users(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  schema_version integer NOT NULL DEFAULT 1,
  snapshot_hash text
);

CREATE INDEX IF NOT EXISTS payment_receipts_transaction_idx ON public.payment_receipts(transaction_id, issued_at);

CREATE TABLE IF NOT EXISTS public.receipt_print_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.payment_receipts(id),
  print_no integer NOT NULL CHECK (print_no > 0),
  copy_label text NOT NULL DEFAULT '',
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','PRINT_DIALOG_OPENED','CONFIRMED','FAILED','UNKNOWN')),
  idempotency_key uuid NOT NULL UNIQUE,
  printer_target text,
  physical_confirmed_at timestamptz,
  error_code text,
  error_message text,
  UNIQUE (receipt_id, print_no)
);

CREATE INDEX IF NOT EXISTS receipt_print_requests_receipt_idx ON public.receipt_print_requests(receipt_id, print_no);

INSERT INTO public.receipt_template_versions
  (template_kind, version, preset, language, paper_width_mm, blocks, header_config, footer_config, status)
SELECT kind, 1, 'STANDARD', 'en', 58,
  '[{"key":"header","required":true},{"key":"transaction_details","required":true},{"key":"description","required":true},{"key":"payment_history","required":false},{"key":"current_payment","required":true},{"key":"totals","required":true},{"key":"footer","required":true}]'::jsonb,
  '{"title":"Baturaden 25 Homestay","address":"Jl. Baturaden Raya No. 25, Ciwastra","city":"Bandung City","whatsapp":"0811669505"}'::jsonb,
  CASE WHEN kind = 'BOOKING' THEN '{"thank_you":"Thank you for booking"}'::jsonb ELSE '{"thank_you":"Thank you for your visit"}'::jsonb END,
  'ACTIVE'
FROM (VALUES ('BOOKING'::text), ('WALK_IN'::text)) AS defaults(kind)
WHERE NOT EXISTS (
  SELECT 1 FROM public.receipt_template_versions v
  WHERE v.template_kind = defaults.kind AND v.status = 'ACTIVE'
);

CREATE OR REPLACE FUNCTION public.create_reservation(
  _mode text, _room_id uuid, _package_id uuid, _name text, _phone text,
  _address text, _amount numeric, _method text, _day_mode text,
  _scheduled_check_in timestamptz, _idempotency_key uuid, _session_id uuid,
  _guest_count integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  selected_price numeric(12,2);
  total_price numeric(12,2);
  extra_count integer;
  extra_charge numeric(12,2);
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
  IF _guest_count IS NULL OR _guest_count < 1 THEN RAISE EXCEPTION 'Jumlah tamu tidak valid'; END IF;

  extra_count := GREATEST(_guest_count - 2, 0);
  extra_charge := extra_count * 50000;

  request_fingerprint := md5(jsonb_build_object(
    'mode', _mode, 'room_id', _room_id, 'package_id', _package_id,
    'name', trim(_name), 'phone', _phone, 'address', trim(_address),
    'amount', _amount, 'method', _method, 'day_mode', _day_mode,
    'scheduled_check_in', _scheduled_check_in, 'session_id', _session_id,
    'guest_count', _guest_count
  )::text);

  INSERT INTO public.finance_reservation_idempotency
    (idempotency_key, request_fingerprint, created_by)
  VALUES (_idempotency_key, request_fingerprint, auth.uid())
  ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT * INTO existing_idempotency
  FROM public.finance_reservation_idempotency
  WHERE idempotency_key = _idempotency_key FOR UPDATE;

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
    SELECT t.scheduled_check_in, t.scheduled_check_out INTO planned_check_in, planned_check_out
    FROM public.calculate_scheduled_booking_times(_package_id, _scheduled_check_in) t;
    IF planned_check_in IS NULL OR planned_check_out IS NULL OR planned_check_out <= planned_check_in THEN RAISE EXCEPTION 'Jadwal booking tidak valid'; END IF;
    operational_date := (planned_check_in AT TIME ZONE 'Asia/Jakarta')::date;
  ELSE
    SELECT t.started_at, t.ends_at INTO actual_started_at, actual_ends_at
    FROM public.calculate_package_stay_times(_package_id, now()) t;
    IF actual_started_at IS NULL OR actual_ends_at IS NULL OR actual_ends_at <= actual_started_at THEN RAISE EXCEPTION 'Waktu check-in tidak valid'; END IF;
    operational_date := (actual_started_at AT TIME ZONE 'Asia/Jakarta')::date;
  END IF;

  authoritative_day_mode := public.get_operational_day_mode(operational_date);
  IF authoritative_day_mode IS NULL OR authoritative_day_mode NOT IN ('weekday', 'weekend') THEN RAISE EXCEPTION 'Jenis hari operasional tidak valid'; END IF;

  SELECT CASE WHEN authoritative_day_mode = 'weekday' THEN pr.weekday_price ELSE pr.weekend_price END
  INTO selected_price
  FROM public.rooms r
  JOIN public.room_types rt ON rt.id = r.room_type_id
  JOIN public.packages p ON p.id = _package_id AND p.active
  JOIN public.package_room_type_prices pr ON pr.package_id = p.id AND pr.pricing_group = rt.pricing_group
  WHERE r.id = _room_id;
  IF NOT FOUND OR selected_price IS NULL THEN RAISE EXCEPTION 'Harga resmi untuk kombinasi kamar dan paket tidak tersedia'; END IF;

  total_price := selected_price + extra_charge;
  IF _amount IS NULL OR _amount < 0 OR _amount > total_price THEN RAISE EXCEPTION 'Nominal pembayaran tidak valid'; END IF;
  IF _mode = 'check_in' AND _amount <> total_price THEN RAISE EXCEPTION 'Check-in langsung harus dibayar lunas'; END IF;

  PERFORM 1 FROM public.rooms WHERE id = _room_id AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kamar tidak aktif atau tidak tersedia'; END IF;
  IF _mode = 'booking' THEN
    IF EXISTS (SELECT 1 FROM public.transactions tr WHERE tr.room_id = _room_id AND tr.status = 'booking' AND tr.scheduled_check_in IS NOT NULL AND tr.scheduled_check_out IS NOT NULL AND tr.scheduled_check_in < planned_check_out AND tr.scheduled_check_out > planned_check_in) THEN
      RAISE EXCEPTION 'Jadwal kamar bentrok dengan booking lain';
    END IF;
  ELSE
    UPDATE public.rooms SET status = 'occupied' WHERE id = _room_id AND status = 'ready' AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Kamar tidak tersedia untuk check-in'; END IF;
    IF EXISTS (SELECT 1 FROM public.transactions tr WHERE tr.room_id = _room_id AND tr.status = 'booking' AND tr.scheduled_check_in IS NOT NULL AND tr.scheduled_check_out IS NOT NULL AND tr.scheduled_check_in < actual_ends_at AND tr.scheduled_check_out > actual_started_at) THEN
      RAISE EXCEPTION 'Waktu check-in bentrok dengan booking terjadwal';
    END IF;
  END IF;

  SELECT id INTO selected_guest FROM public.guests WHERE phone = _phone;
  IF selected_guest IS NULL THEN
    IF length(trim(coalesce(_address, ''))) = 0 THEN RAISE EXCEPTION 'Alamat wajib diisi untuk tamu baru'; END IF;
    INSERT INTO public.guests (full_name, address, phone) VALUES (trim(_name), trim(_address), _phone) RETURNING id INTO selected_guest;
  END IF;

  INSERT INTO public.transactions (
    guest_id, room_id, package_id, status, created_by, price_snapshot, base_price_snapshot,
    guest_count, extra_guest_count, extra_guest_unit_price, extra_guest_charge,
    day_mode, scheduled_check_in, scheduled_check_out, started_at, ends_at
  ) VALUES (
    selected_guest, _room_id, _package_id, _mode::public.transaction_status, auth.uid(), total_price, selected_price,
    _guest_count, extra_count, 50000, extra_charge,
    authoritative_day_mode,
    CASE WHEN _mode = 'booking' THEN planned_check_in END,
    CASE WHEN _mode = 'booking' THEN planned_check_out END,
    CASE WHEN _mode = 'check_in' THEN actual_started_at END,
    CASE WHEN _mode = 'check_in' THEN actual_ends_at END
  ) RETURNING id, transaction_number INTO selected_transaction, number;

  IF _amount > 0 THEN
    INSERT INTO public.payments (transaction_id, amount, method, kind, recorded_by, idempotency_key, cash_session_id)
    VALUES (selected_transaction, _amount, _method, CASE WHEN _mode = 'booking' THEN 'dp' ELSE 'payment' END, auth.uid(), _idempotency_key, _session_id);
  END IF;

  UPDATE public.finance_reservation_idempotency
  SET transaction_id = selected_transaction, transaction_number = number
  WHERE idempotency_key = _idempotency_key;
  RETURN number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_training_reservation(
  _mode text, _room_id uuid, _package_id uuid, _name text, _phone text,
  _address text, _amount numeric, _method text, _day_mode text,
  _scheduled_check_in timestamptz, _idempotency_key uuid, _session_id uuid,
  _guest_count integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE result_number text;
BEGIN
  IF NOT public.finance_training_session_is_valid(auth.uid(), _session_id) THEN
    RAISE EXCEPTION 'Training wajib memakai sesi kas aktif penanggung jawab';
  END IF;
  PERFORM set_config('app.finance_training_session_id', _session_id::text, true);
  SELECT public.create_reservation(_mode, _room_id, _package_id, _name, _phone, _address, _amount, _method, _day_mode, _scheduled_check_in, _idempotency_key, _session_id, _guest_count) INTO result_number;
  RETURN result_number;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.create_training_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_training_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer) TO authenticated;

DO $extra_guest_postcheck$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name='guest_count') THEN
    RAISE EXCEPTION 'Extra Guest columns were not installed';
  END IF;
  IF to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer)') IS NULL THEN
    RAISE EXCEPTION 'Extra Guest reservation RPC was not installed';
  END IF;
END
$extra_guest_postcheck$;

COMMIT;
