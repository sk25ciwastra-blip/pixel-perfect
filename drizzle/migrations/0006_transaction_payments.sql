CREATE TYPE public.payment_method AS ENUM ('cash', 'qris', 'transfer');
CREATE TYPE public.payment_kind AS ENUM ('dp', 'pelunasan', 'extend', 'overtime', 'lainnya');

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES public.packages(id),
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz;

DROP POLICY IF EXISTS employee_owner_read ON public.employees;
CREATE POLICY employee_self_or_owner ON public.employees
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR user_id = auth.uid());

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  method public.payment_method NOT NULL,
  kind public.payment_kind NOT NULL DEFAULT 'pelunasan',
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  note text NOT NULL DEFAULT '',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_read ON public.payments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.is_receptionist(auth.uid()));

CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  payment_id uuid REFERENCES public.payments(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY refunds_owner_read ON public.refunds
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER audit_payments AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
CREATE TRIGGER audit_refunds AFTER INSERT OR UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.audit_changes();

DROP FUNCTION IF EXISTS public.create_checkin(uuid, uuid, uuid);

CREATE FUNCTION public.create_checkin(
  _room_id uuid,
  _guest_id uuid,
  _package_id uuid,
  _payment_method public.payment_method
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chosen_price numeric;
  duration integer;
  number text;
  tx_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'owner') OR public.is_receptionist(auth.uid())) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.guests WHERE id = _guest_id) THEN
    RAISE EXCEPTION 'Tamu tidak ditemukan';
  END IF;
  SELECT price, duration_minutes INTO chosen_price, duration
  FROM public.packages
  WHERE id = _package_id AND active;
  IF chosen_price IS NULL THEN
    RAISE EXCEPTION 'Paket tidak tersedia';
  END IF;
  UPDATE public.rooms
  SET status = 'occupied'
  WHERE id = _room_id AND status = 'ready' AND active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kamar tidak tersedia';
  END IF;
  INSERT INTO public.transactions (
    guest_id, room_id, package_id, status, created_by, price_snapshot, checked_in_at, scheduled_end_at
  ) VALUES (
    _guest_id, _room_id, _package_id, 'check_in', auth.uid(), chosen_price, now(), now() + make_interval(mins => duration)
  ) RETURNING id, transaction_number INTO tx_id, number;
  INSERT INTO public.payments (transaction_id, method, kind, amount, created_by)
  VALUES (tx_id, _payment_method, 'pelunasan', chosen_price, auth.uid());
  RETURN number;
END
$$;
REVOKE ALL ON FUNCTION public.create_checkin(uuid, uuid, uuid, public.payment_method) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_checkin(uuid, uuid, uuid, public.payment_method) TO authenticated;

CREATE FUNCTION public.record_refund(_transaction_id uuid, _amount numeric, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;
  IF _amount <= 0 OR length(trim(_reason)) = 0 THEN
    RAISE EXCEPTION 'Jumlah dan alasan refund wajib diisi';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = _transaction_id) THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan';
  END IF;
  INSERT INTO public.refunds (transaction_id, amount, reason, created_by)
  VALUES (_transaction_id, _amount, trim(_reason), auth.uid());
END
$$;
REVOKE ALL ON FUNCTION public.record_refund(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_refund(uuid, numeric, text) TO authenticated;
