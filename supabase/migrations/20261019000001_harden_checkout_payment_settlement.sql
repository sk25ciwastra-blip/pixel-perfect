BEGIN;

-- P0-02B: server-side payment settlement hardening for checkout.
-- Forward-only. No historical migration, data, number, or Dashboard UI is changed.

DO $preflight$
BEGIN
  IF to_regclass('public.transactions') IS NULL
     OR to_regclass('public.payments') IS NULL
     OR to_regclass('public.finance_charge_events') IS NULL
     OR to_regclass('public.finance_refunds') IS NULL
     OR to_regclass('public.rooms') IS NULL
     OR to_regclass('public.activity_logs') IS NULL THEN
    RAISE EXCEPTION
      'Checkout hardening membutuhkan transactions, payments, rooms, dan activity_logs';
  END IF;

  IF to_regprocedure('public.can_frontdesk(uuid)') IS NULL
     OR to_regprocedure('public.check_out_transaction(uuid)') IS NULL THEN
    RAISE EXCEPTION
      'Checkout hardening membutuhkan can_frontdesk(uuid) dan check_out_transaction(uuid)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transactions'
      AND column_name IN ('price_snapshot', 'status', 'room_id')
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 3
  ) THEN
    RAISE EXCEPTION
      'transactions tidak memiliki kolom settlement yang dibutuhkan';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payments'
      AND column_name IN ('transaction_id', 'amount', 'method')
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 3
  ) THEN
    RAISE EXCEPTION
      'payments tidak memiliki kolom settlement yang dibutuhkan';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'finance_charge_events'
      AND column_name IN ('transaction_id', 'amount')
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 2
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'finance_refunds'
      AND column_name IN ('transaction_id', 'amount')
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 2
  ) THEN
    RAISE EXCEPTION
      'Charge/refund settlement columns belum tersedia';
  END IF;
END;
$preflight$;

-- Every payment mutation takes the same transaction-row lock used by checkout.
-- A payment that races after checkout commits is rejected instead of being
-- silently added to a closed transaction.
CREATE OR REPLACE FUNCTION public.guard_payment_transaction_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  target_transaction_id uuid;
  target_status public.transaction_status;
BEGIN
  target_transaction_id := COALESCE(NEW.transaction_id, OLD.transaction_id);

  SELECT t.status
  INTO target_status
  FROM public.transactions t
  WHERE t.id = target_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi pembayaran tidak ditemukan';
  END IF;

  IF target_status IN ('check_out', 'cancelled') THEN
    RAISE EXCEPTION
      'Pembayaran tidak dapat diubah setelah transaksi ditutup atau dibatalkan';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.transaction_id <> OLD.transaction_id THEN
    RAISE EXCEPTION 'Pembayaran tidak dapat dipindahkan ke transaksi lain';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS payments_transaction_state_guard_trigger
ON public.payments;

CREATE TRIGGER payments_transaction_state_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.guard_payment_transaction_state();

-- Extend/Overtime charge events and refunds participate in the same settlement
-- decision. They must take the transaction lock too, otherwise a charge/refund
-- could race after checkout has already calculated its due amount.
CREATE OR REPLACE FUNCTION public.guard_settlement_transaction_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  target_transaction_id uuid;
  target_status public.transaction_status;
BEGIN
  target_transaction_id := COALESCE(NEW.transaction_id, OLD.transaction_id);

  SELECT t.status
  INTO target_status
  FROM public.transactions t
  WHERE t.id = target_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi settlement tidak ditemukan';
  END IF;

  IF target_status IN ('check_out', 'cancelled') THEN
    RAISE EXCEPTION
      'Settlement tidak dapat diubah setelah transaksi ditutup atau dibatalkan';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.transaction_id IS DISTINCT FROM OLD.transaction_id THEN
    RAISE EXCEPTION 'Settlement tidak dapat dipindahkan ke transaksi lain';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS charge_events_transaction_state_guard_trigger
ON public.finance_charge_events;
CREATE TRIGGER charge_events_transaction_state_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_charge_events
FOR EACH ROW
EXECUTE FUNCTION public.guard_settlement_transaction_state();

DROP TRIGGER IF EXISTS refunds_transaction_state_guard_trigger
ON public.finance_refunds;
CREATE TRIGGER refunds_transaction_state_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_refunds
FOR EACH ROW
EXECUTE FUNCTION public.guard_settlement_transaction_state();

-- Keep the existing RPC contract and official checkout/Housekeeping transition,
-- but make payment settlement a database decision under the transaction lock.
CREATE OR REPLACE FUNCTION public.check_out_transaction(_transaction_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  selected_transaction record;
  base_amount numeric(12,2);
  charge_amount numeric(12,2);
  gross_paid numeric(12,2);
  refunded_amount numeric(12,2);
  net_paid numeric(12,2);
  settlement_due numeric(12,2);
BEGIN
  IF NOT public.can_frontdesk(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT
    id,
    transaction_number,
    room_id,
    status,
    price_snapshot
  INTO selected_transaction
  FROM public.transactions
  WHERE id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan';
  END IF;

  IF selected_transaction.status <> 'check_in' THEN
    RAISE EXCEPTION 'Hanya transaksi CHECK-IN yang dapat di-check-out';
  END IF;

  IF selected_transaction.price_snapshot IS NULL
     OR selected_transaction.price_snapshot < 0 THEN
    RAISE EXCEPTION 'Tagihan transaksi tidak valid untuk Check-out';
  END IF;

  base_amount := selected_transaction.price_snapshot;

  SELECT COALESCE(SUM(c.amount), 0)
  INTO charge_amount
  FROM public.finance_charge_events c
  WHERE c.transaction_id = selected_transaction.id;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO gross_paid
  FROM public.payments p
  WHERE p.transaction_id = selected_transaction.id;

  SELECT COALESCE(SUM(r.amount), 0)
  INTO refunded_amount
  FROM public.finance_refunds r
  WHERE r.transaction_id = selected_transaction.id;

  net_paid := gross_paid - refunded_amount;
  settlement_due := base_amount + charge_amount;

  IF net_paid < settlement_due THEN
    RAISE EXCEPTION
      'Check-out ditolak: sisa settlement masih %',
      settlement_due - net_paid;
  END IF;

  IF net_paid > settlement_due THEN
    RAISE EXCEPTION
      'Check-out ditolak: settlement bersih % melebihi kewajiban %',
      net_paid,
      settlement_due;
  END IF;

  UPDATE public.rooms
  SET status = 'dirty'
  WHERE id = selected_transaction.room_id
    AND status = 'occupied';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kamar transaksi tidak berstatus TERISI';
  END IF;

  UPDATE public.transactions
  SET
    status = 'check_out',
    checked_out_at = now()
  WHERE id = selected_transaction.id;

  INSERT INTO public.activity_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    description
  )
  VALUES (
    auth.uid(),
    'check_out',
    'transaction',
    selected_transaction.id,
    'Check-out transaksi ' || selected_transaction.transaction_number
  );

  RETURN selected_transaction.transaction_number;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_payment_transaction_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_settlement_transaction_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_out_transaction(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_out_transaction(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_out_transaction(uuid) TO authenticated;

COMMENT ON FUNCTION public.check_out_transaction(uuid) IS
  'P0-02B: locked checkout with database-authoritative exact payment settlement.';

COMMIT;
