BEGIN;

-- Forward-only combined payment support. Legacy one-method RPCs remain intact.
CREATE TABLE IF NOT EXISTS public.finance_payment_batch_idempotency (
  request_idempotency_key uuid PRIMARY KEY,
  operation text NOT NULL CHECK (operation IN ('reservation', 'settlement')),
  request_fingerprint text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  transaction_id uuid REFERENCES public.transactions(id),
  transaction_number text,
  payment_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(payment_ids) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS finance_payment_batch_transaction_idx ON public.finance_payment_batch_idempotency (transaction_id);
ALTER TABLE public.finance_payment_batch_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.finance_payment_batch_idempotency FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.finance_payment_batch_idempotency TO authenticated;
DROP POLICY IF EXISTS finance_payment_batch_read ON public.finance_payment_batch_idempotency;
CREATE POLICY finance_payment_batch_read ON public.finance_payment_batch_idempotency FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.finance_is_owner_or_supervisor(auth.uid()));

CREATE OR REPLACE FUNCTION public.create_reservation_combined(
  _mode text, _room_id uuid, _package_id uuid, _name text, _phone text, _address text,
  _payments jsonb, _day_mode text, _scheduled_check_in timestamptz DEFAULT NULL,
  _request_idempotency_key uuid DEFAULT NULL, _request_fingerprint text DEFAULT NULL,
  _session_id uuid DEFAULT NULL, _guest_count integer DEFAULT 2
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  selected_price numeric(12,2); total_price numeric(12,2); extra_count integer; extra_charge numeric(12,2); payment_total numeric(12,2);
  selected_guest uuid; selected_transaction uuid; selected_number text; actual_started_at timestamptz; actual_ends_at timestamptz; planned_check_in timestamptz; planned_check_out timestamptz;
  computed_fingerprint text;
  authoritative_day_mode text; operational_date date; minimum_dp numeric(12,2); batch_row public.finance_payment_batch_idempotency; component record; payment_id uuid; created_payment_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF _request_idempotency_key IS NULL OR length(trim(coalesce(_request_fingerprint, ''))) = 0 THEN RAISE EXCEPTION 'Idempotency key dan fingerprint pembayaran wajib diisi'; END IF;
  IF NOT public.finance_is_booking_operator(auth.uid()) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF _session_id IS NULL THEN RAISE EXCEPTION 'Sesi kas aktif wajib dipilih oleh server'; END IF;
  IF jsonb_typeof(_payments) IS DISTINCT FROM 'array' OR jsonb_array_length(_payments) NOT BETWEEN 1 AND 2 THEN RAISE EXCEPTION 'Pembayaran gabungan harus berisi maksimal dua metode'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(_payments) AS p(method text, amount numeric, idempotency_key uuid) WHERE coalesce(p.method NOT IN ('Cash', 'QRIS', 'Transfer'), true) OR p.amount IS NULL OR p.amount <= 0 OR p.amount <> trunc(p.amount) OR p.idempotency_key IS NULL) THEN RAISE EXCEPTION 'Setiap pembayaran harus memiliki metode, nominal rupiah positif, dan idempotency key'; END IF;
  IF (SELECT count(DISTINCT p.method) FROM jsonb_to_recordset(_payments) AS p(method text, amount numeric, idempotency_key uuid)) <> jsonb_array_length(_payments) THEN RAISE EXCEPTION 'Metode pembayaran harus berbeda'; END IF;
  IF (SELECT count(*) FROM jsonb_to_recordset(_payments) AS p(method text, amount numeric, idempotency_key uuid)) <> (SELECT count(DISTINCT p.idempotency_key) FROM jsonb_to_recordset(_payments) AS p(method text, amount numeric, idempotency_key uuid)) THEN RAISE EXCEPTION 'Idempotency key setiap pembayaran harus unik'; END IF;
  -- Bind idempotency to the actual payload, not only the caller-provided fingerprint.
  computed_fingerprint := md5(jsonb_build_object(
    'caller_fingerprint', _request_fingerprint,
    'mode', _mode, 'room_id', _room_id, 'package_id', _package_id,
    'name', _name, 'phone', _phone, 'address', _address,
    'payments', _payments, 'day_mode', _day_mode,
    'scheduled_check_in', _scheduled_check_in,
    'session_id', _session_id, 'guest_count', _guest_count
  )::text);
  INSERT INTO public.finance_payment_batch_idempotency(request_idempotency_key, operation, request_fingerprint, created_by) VALUES (_request_idempotency_key, 'reservation', computed_fingerprint, auth.uid()) ON CONFLICT (request_idempotency_key) DO NOTHING;
  SELECT * INTO batch_row FROM public.finance_payment_batch_idempotency WHERE request_idempotency_key = _request_idempotency_key FOR UPDATE;
  IF batch_row.created_by <> auth.uid() OR batch_row.operation <> 'reservation' OR batch_row.request_fingerprint <> computed_fingerprint THEN RAISE EXCEPTION 'Fingerprint pembayaran gabungan berbeda dari retry sebelumnya'; END IF;
  IF batch_row.transaction_id IS NOT NULL THEN RETURN jsonb_build_object('transaction_id', batch_row.transaction_id, 'transaction_number', batch_row.transaction_number, 'payment_ids', batch_row.payment_ids); END IF;
  IF _guest_count IS NULL OR _guest_count < 1 THEN RAISE EXCEPTION 'Jumlah tamu tidak valid'; END IF;
  extra_count := greatest(_guest_count - 2, 0); extra_charge := extra_count * 50000;
  SELECT coalesce(sum(p.amount), 0) INTO payment_total FROM jsonb_to_recordset(_payments) AS p(method text, amount numeric, idempotency_key uuid);
  IF _mode IS NULL OR _mode NOT IN ('booking', 'check_in') THEN RAISE EXCEPTION 'Jenis transaksi tidak valid'; END IF;
  IF length(trim(coalesce(_name, ''))) NOT BETWEEN 1 AND 100 OR coalesce(_phone, '') !~ '^[0-9+]{8,16}$' OR length(coalesce(_address, '')) > 500 THEN RAISE EXCEPTION 'Data tamu tidak valid'; END IF;
  IF _mode = 'booking' AND _scheduled_check_in IS NULL THEN RAISE EXCEPTION 'Tanggal dan jam check-in wajib dipilih untuk booking'; END IF;
  IF _mode = 'booking' THEN
    SELECT t.scheduled_check_in, t.scheduled_check_out INTO planned_check_in, planned_check_out FROM public.calculate_scheduled_booking_times(_package_id, _scheduled_check_in) t;
    IF planned_check_in IS NULL OR planned_check_out IS NULL OR planned_check_out <= planned_check_in THEN RAISE EXCEPTION 'Jadwal booking tidak valid'; END IF;
    operational_date := (planned_check_in AT TIME ZONE 'Asia/Jakarta')::date;
  ELSE
    SELECT t.started_at, t.ends_at INTO actual_started_at, actual_ends_at FROM public.calculate_package_stay_times(_package_id, now()) t;
    IF actual_started_at IS NULL OR actual_ends_at IS NULL OR actual_ends_at <= actual_started_at THEN RAISE EXCEPTION 'Waktu check-in tidak valid'; END IF;
    operational_date := (actual_started_at AT TIME ZONE 'Asia/Jakarta')::date;
  END IF;
  authoritative_day_mode := public.get_operational_day_mode(operational_date);
  IF authoritative_day_mode IS NULL OR authoritative_day_mode NOT IN ('weekday', 'weekend') THEN RAISE EXCEPTION 'Jenis hari operasional tidak valid'; END IF;
  SELECT CASE WHEN authoritative_day_mode = 'weekday' THEN pr.weekday_price ELSE pr.weekend_price END INTO selected_price FROM public.rooms r JOIN public.room_types rt ON rt.id = r.room_type_id JOIN public.packages p ON p.id = _package_id AND p.active JOIN public.package_room_type_prices pr ON pr.package_id = p.id AND pr.pricing_group = rt.pricing_group WHERE r.id = _room_id;
  IF NOT FOUND OR selected_price IS NULL THEN RAISE EXCEPTION 'Harga resmi untuk kombinasi kamar dan paket tidak tersedia'; END IF;
  total_price := selected_price + extra_charge;
  IF payment_total <= 0 OR payment_total > total_price THEN RAISE EXCEPTION 'Total pembayaran tidak boleh melebihi tagihan'; END IF;
  IF _mode = 'booking' THEN
    SELECT CASE s.minimum_dp_mode WHEN 'PERCENTAGE' THEN ceil(total_price * s.minimum_dp_value / 100) ELSE s.minimum_dp_value END INTO minimum_dp FROM public.finance_settings s WHERE s.id = true;
    IF payment_total < coalesce(minimum_dp, 0) THEN RAISE EXCEPTION 'Booking wajib memiliki DP minimum sesuai aturan Owner'; END IF;
  ELSIF payment_total <> total_price THEN RAISE EXCEPTION 'Check-in langsung harus dibayar lunas'; END IF;
  PERFORM 1 FROM public.rooms WHERE id = _room_id AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kamar tidak aktif atau tidak tersedia'; END IF;
  IF _mode = 'booking' THEN
    IF EXISTS (SELECT 1 FROM public.transactions tr WHERE tr.room_id = _room_id AND tr.status = 'booking' AND tr.scheduled_check_in IS NOT NULL AND tr.scheduled_check_out IS NOT NULL AND tr.scheduled_check_in < planned_check_out AND tr.scheduled_check_out > planned_check_in) THEN RAISE EXCEPTION 'Jadwal kamar bentrok dengan booking lain'; END IF;
  ELSE
    UPDATE public.rooms SET status = 'occupied' WHERE id = _room_id AND status = 'ready' AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Kamar tidak tersedia untuk check-in'; END IF;
    IF EXISTS (SELECT 1 FROM public.transactions tr WHERE tr.room_id = _room_id AND tr.status = 'booking' AND tr.scheduled_check_in IS NOT NULL AND tr.scheduled_check_out IS NOT NULL AND tr.scheduled_check_in < actual_ends_at AND tr.scheduled_check_out > actual_started_at) THEN RAISE EXCEPTION 'Waktu check-in bentrok dengan booking terjadwal'; END IF;
  END IF;
  SELECT id INTO selected_guest FROM public.guests WHERE phone = _phone;
  IF selected_guest IS NULL THEN
    IF length(trim(coalesce(_address, ''))) = 0 THEN RAISE EXCEPTION 'Alamat wajib diisi untuk tamu baru'; END IF;
    INSERT INTO public.guests(full_name, address, phone) VALUES(trim(_name), trim(_address), _phone) RETURNING id INTO selected_guest;
  END IF;
  INSERT INTO public.transactions(guest_id, room_id, package_id, status, created_by, price_snapshot, guest_count, extra_guest_count, extra_guest_unit_price, extra_guest_charge, day_mode, scheduled_check_in, scheduled_check_out, started_at, ends_at)
  VALUES (selected_guest, _room_id, _package_id, _mode::public.transaction_status, auth.uid(), total_price, _guest_count, extra_count, 50000, extra_charge, authoritative_day_mode, CASE WHEN _mode = 'booking' THEN planned_check_in END, CASE WHEN _mode = 'booking' THEN planned_check_out END, CASE WHEN _mode = 'check_in' THEN actual_started_at END, CASE WHEN _mode = 'check_in' THEN actual_ends_at END)
  RETURNING id, transaction_number INTO selected_transaction, selected_number;
  FOR component IN SELECT p.method, p.amount, p.idempotency_key FROM jsonb_to_recordset(_payments) AS p(method text, amount numeric, idempotency_key uuid) LOOP
    IF EXISTS (SELECT 1 FROM public.payments WHERE idempotency_key = component.idempotency_key) THEN RAISE EXCEPTION 'Idempotency key pembayaran sudah digunakan'; END IF;
    INSERT INTO public.payments(transaction_id, amount, method, kind, recorded_by, idempotency_key, cash_session_id) VALUES(selected_transaction, component.amount, component.method, CASE WHEN _mode = 'booking' THEN 'dp' ELSE 'payment' END, auth.uid(), component.idempotency_key, _session_id) RETURNING id INTO payment_id;
    created_payment_ids := array_append(created_payment_ids, payment_id);
  END LOOP;
  UPDATE public.finance_payment_batch_idempotency SET transaction_id = selected_transaction, transaction_number = selected_number, payment_ids = to_jsonb(created_payment_ids) WHERE request_idempotency_key = _request_idempotency_key;
  RETURN jsonb_build_object('transaction_id', selected_transaction, 'transaction_number', selected_number, 'payment_ids', to_jsonb(created_payment_ids));
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_transaction_payment_combined(_transaction_id uuid, _payments jsonb, _request_idempotency_key uuid, _request_fingerprint text, _session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE selected_transaction record; batch_row public.finance_payment_batch_idempotency; payment_total numeric(12,2); already_paid numeric(12,2); payment_id uuid; component record; created_payment_ids uuid[] := ARRAY[]::uuid[]; computed_fingerprint text;
BEGIN
  IF _request_idempotency_key IS NULL OR length(trim(coalesce(_request_fingerprint, ''))) = 0 OR _session_id IS NULL THEN RAISE EXCEPTION 'Idempotency key, fingerprint, dan sesi kas wajib diisi'; END IF;
  IF NOT public.finance_is_booking_operator(auth.uid()) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF jsonb_typeof(_payments) IS DISTINCT FROM 'array' OR jsonb_array_length(_payments) NOT BETWEEN 1 AND 2 THEN RAISE EXCEPTION 'Pembayaran gabungan harus berisi maksimal dua metode'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(_payments) AS p(method text, amount numeric, idempotency_key uuid) WHERE coalesce(p.method NOT IN ('Cash', 'QRIS', 'Transfer'), true) OR p.amount IS NULL OR p.amount <= 0 OR p.amount <> trunc(p.amount) OR p.idempotency_key IS NULL) THEN RAISE EXCEPTION 'Setiap pembayaran harus memiliki metode, nominal rupiah positif, dan idempotency key'; END IF;
  IF (SELECT count(DISTINCT p.method) FROM jsonb_to_recordset(_payments) AS p(method text, amount numeric, idempotency_key uuid)) <> jsonb_array_length(_payments) THEN RAISE EXCEPTION 'Metode pembayaran harus berbeda'; END IF;
  IF (SELECT count(*) FROM jsonb_to_recordset(_payments) AS p(method text, amount numeric, idempotency_key uuid)) <> (SELECT count(DISTINCT p.idempotency_key) FROM jsonb_to_recordset(_payments) AS p(method text, amount numeric, idempotency_key uuid)) THEN RAISE EXCEPTION 'Idempotency key setiap pembayaran harus unik'; END IF;
  -- Any changed payment amount, method, key, target, or session invalidates a retry.
  computed_fingerprint := md5(jsonb_build_object(
    'caller_fingerprint', _request_fingerprint, 'transaction_id', _transaction_id,
    'payments', _payments, 'session_id', _session_id
  )::text);
  INSERT INTO public.finance_payment_batch_idempotency(request_idempotency_key, operation, request_fingerprint, created_by, transaction_id) VALUES(_request_idempotency_key, 'settlement', computed_fingerprint, auth.uid(), _transaction_id) ON CONFLICT (request_idempotency_key) DO NOTHING;
  SELECT * INTO batch_row FROM public.finance_payment_batch_idempotency WHERE request_idempotency_key = _request_idempotency_key FOR UPDATE;
  IF batch_row.created_by <> auth.uid() OR batch_row.operation <> 'settlement' OR batch_row.transaction_id <> _transaction_id OR batch_row.request_fingerprint <> computed_fingerprint THEN RAISE EXCEPTION 'Fingerprint pembayaran gabungan berbeda dari retry sebelumnya'; END IF;
  IF batch_row.payment_ids <> '[]'::jsonb THEN RETURN jsonb_build_object('transaction_id', batch_row.transaction_id, 'transaction_number', batch_row.transaction_number, 'payment_ids', batch_row.payment_ids); END IF;
  SELECT t.id, t.transaction_number, t.price_snapshot, t.status INTO selected_transaction FROM public.transactions t WHERE t.id = _transaction_id FOR UPDATE;
  IF NOT FOUND OR selected_transaction.status NOT IN ('booking', 'check_in') THEN RAISE EXCEPTION 'Transaksi Booking tidak dapat menerima pelunasan'; END IF;
  SELECT coalesce(sum(p.amount), 0) INTO payment_total FROM jsonb_to_recordset(_payments) AS p(method text, amount numeric, idempotency_key uuid);
  SELECT coalesce(sum(p.amount), 0) INTO already_paid FROM public.payments p WHERE p.transaction_id = _transaction_id;
  IF payment_total > selected_transaction.price_snapshot - already_paid THEN RAISE EXCEPTION 'Nominal pembayaran melebihi sisa tagihan'; END IF;
  FOR component IN SELECT p.method, p.amount, p.idempotency_key FROM jsonb_to_recordset(_payments) AS p(method text, amount numeric, idempotency_key uuid) LOOP
    IF EXISTS (SELECT 1 FROM public.payments WHERE idempotency_key = component.idempotency_key) THEN RAISE EXCEPTION 'Idempotency key pembayaran sudah digunakan'; END IF;
    INSERT INTO public.payments(transaction_id, amount, method, kind, recorded_by, idempotency_key, cash_session_id) VALUES(_transaction_id, component.amount, component.method, 'payment', auth.uid(), component.idempotency_key, _session_id) RETURNING id INTO payment_id;
    created_payment_ids := array_append(created_payment_ids, payment_id);
  END LOOP;
  UPDATE public.finance_payment_batch_idempotency SET transaction_number = selected_transaction.transaction_number, payment_ids = to_jsonb(created_payment_ids) WHERE request_idempotency_key = _request_idempotency_key;
  RETURN jsonb_build_object('transaction_id', _transaction_id, 'transaction_number', selected_transaction.transaction_number, 'payment_ids', to_jsonb(created_payment_ids));
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_training_reservation_combined(_mode text, _room_id uuid, _package_id uuid, _name text, _phone text, _address text, _payments jsonb, _day_mode text, _scheduled_check_in timestamptz DEFAULT NULL, _request_idempotency_key uuid DEFAULT NULL, _request_fingerprint text DEFAULT NULL, _session_id uuid DEFAULT NULL, _guest_count integer DEFAULT 2)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  IF NOT public.finance_training_session_is_valid(auth.uid(), _session_id) THEN RAISE EXCEPTION 'Training wajib memakai sesi kas aktif penanggung jawab'; END IF;
  PERFORM set_config('app.finance_training_session_id', _session_id::text, true);
  RETURN public.create_reservation_combined(_mode, _room_id, _package_id, _name, _phone, _address, _payments, _day_mode, _scheduled_check_in, _request_idempotency_key, _request_fingerprint, _session_id, _guest_count);
END;
$function$;
CREATE OR REPLACE FUNCTION public.record_training_transaction_payment_combined(_transaction_id uuid, _payments jsonb, _request_idempotency_key uuid, _request_fingerprint text, _session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  IF NOT public.finance_training_session_is_valid(auth.uid(), _session_id) THEN RAISE EXCEPTION 'Training wajib memakai sesi kas aktif penanggung jawab'; END IF;
  PERFORM set_config('app.finance_training_session_id', _session_id::text, true);
  RETURN public.record_transaction_payment_combined(_transaction_id, _payments, _request_idempotency_key, _request_fingerprint, _session_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_reservation_combined(text, uuid, uuid, text, text, text, jsonb, text, timestamptz, uuid, text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_reservation_combined(text, uuid, uuid, text, text, text, jsonb, text, timestamptz, uuid, text, uuid, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.record_transaction_payment_combined(uuid, jsonb, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_transaction_payment_combined(uuid, jsonb, uuid, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.create_training_reservation_combined(text, uuid, uuid, text, text, text, jsonb, text, timestamptz, uuid, text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_training_reservation_combined(text, uuid, uuid, text, text, text, jsonb, text, timestamptz, uuid, text, uuid, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.record_training_transaction_payment_combined(uuid, jsonb, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_training_transaction_payment_combined(uuid, jsonb, uuid, text, uuid) TO authenticated;
COMMIT;