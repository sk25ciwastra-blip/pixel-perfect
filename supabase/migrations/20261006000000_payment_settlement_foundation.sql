-- Task 4: Payment settlement foundation
-- Baturaden 25 Homestay
--
-- Source of truth:
--   transactions.price_snapshot = total tagihan transaksi
--   SUM(payments.amount)         = total pembayaran tercatat
--   sisa tagihan                 = price_snapshot - total pembayaran
--
-- This RPC records an additional payment safely.
-- It does not handle overtime, refunds, or receipt printing.

CREATE OR REPLACE FUNCTION public.record_transaction_payment(
  _transaction_id uuid,
  _amount numeric,
  _method text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_transaction record;
  already_paid numeric(12,2);
  remaining_amount numeric(12,2);
  new_payment_id uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'owner')
    OR public.is_receptionist(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  IF _method IS NULL
     OR _method NOT IN ('Cash', 'QRIS', 'Transfer') THEN
    RAISE EXCEPTION 'Metode pembayaran tidak valid';
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pembayaran harus lebih dari 0';
  END IF;

  SELECT
    id,
    price_snapshot,
    status
  INTO selected_transaction
  FROM public.transactions
  WHERE id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan';
  END IF;

  IF selected_transaction.status = 'cancelled' THEN
    RAISE EXCEPTION 'Transaksi yang dibatalkan tidak dapat menerima pembayaran';
  END IF;

  IF selected_transaction.price_snapshot IS NULL
     OR selected_transaction.price_snapshot < 0 THEN
    RAISE EXCEPTION 'Tagihan transaksi tidak valid';
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO already_paid
  FROM public.payments
  WHERE transaction_id = selected_transaction.id;

  remaining_amount :=
    selected_transaction.price_snapshot - already_paid;

  IF remaining_amount <= 0 THEN
    RAISE EXCEPTION 'Transaksi sudah lunas';
  END IF;

  IF _amount > remaining_amount THEN
    RAISE EXCEPTION
      'Nominal pembayaran melebihi sisa tagihan';
  END IF;

  INSERT INTO public.payments (
    transaction_id,
    amount,
    method,
    kind,
    recorded_by
  )
  VALUES (
    selected_transaction.id,
    _amount,
    _method,
    'payment',
    auth.uid()
  )
  RETURNING id INTO new_payment_id;

  RETURN new_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_transaction_payment(
  uuid,
  numeric,
  text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_transaction_payment(
  uuid,
  numeric,
  text
) TO authenticated;