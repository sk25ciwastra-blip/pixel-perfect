-- Baturaden 25 Homestay P0 Checkout / Owner Refund parity.
-- REVIEW ONLY. NEVER run on Cloud without explicit Owner migration approval,
-- new verified backup, isolated restore proof, and Cloud preflight recheck.
-- Narrow replacement proposal for old 20261019000001_harden_checkout_payment_settlement.sql.
-- DO NOT execute the old migration after this one (it blocks valid refunds).

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $preflight$
DECLARE
  checkout_row record;
  refund_row record;
  missing_count integer;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'STOP: expected audited postgres role';
  END IF;
  SELECT COUNT(*) INTO missing_count FROM (VALUES
    ('transactions','status'),('transactions','room_id'),('transactions','price_snapshot'),
    ('transactions','transaction_number'),('transactions','checked_out_at'),
    ('payments','transaction_id'),('payments','amount'),
    ('finance_charge_events','transaction_id'),('finance_charge_events','amount'),
    ('finance_refunds','transaction_id'),('finance_refunds','amount'),
    ('rooms','status'),('activity_logs','user_id'),('activity_logs','action'),
    ('activity_logs','entity_type'),('activity_logs','entity_id'),
    ('activity_logs','description')
  ) AS needed(tbl,col)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=needed.tbl
      AND c.column_name=needed.col
  );
  IF missing_count <> 0 THEN
    RAISE EXCEPTION 'STOP: missing % required columns', missing_count;
  END IF;
  IF to_regprocedure('public.can_frontdesk(uuid)') IS NULL
     OR to_regprocedure('public.check_out_transaction(uuid)') IS NULL
     OR to_regprocedure('public.create_finance_refund(uuid,uuid,numeric,text,text,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'STOP: expected RPC missing';
  END IF;

  SELECT md5(p.prosrc) AS body_hash,p.prosecdef AS secdef,
         pg_get_userbyid(p.proowner) AS owner_name,
         has_function_privilege('authenticated',p.oid,'EXECUTE') AS auth_exec,
         has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec
    INTO checkout_row FROM pg_proc p
    WHERE p.oid=to_regprocedure('public.check_out_transaction(uuid)');
  IF checkout_row.body_hash IS DISTINCT FROM 'eaa0b3e3cf13478999dee8daaa9b2e92'
     OR checkout_row.secdef IS DISTINCT FROM TRUE
     OR checkout_row.owner_name IS DISTINCT FROM 'postgres'
     OR checkout_row.auth_exec IS DISTINCT FROM TRUE
     OR checkout_row.anon_exec IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'STOP: unexpected Cloud Checkout body/ACL';
  END IF;

  SELECT md5(p.prosrc) AS body_hash,p.prosecdef AS secdef,
         pg_get_userbyid(p.proowner) AS owner_name
    INTO refund_row FROM pg_proc p
    WHERE p.oid=to_regprocedure('public.create_finance_refund(uuid,uuid,numeric,text,text,uuid,text)');
  IF refund_row.body_hash IS DISTINCT FROM '80bcdeabfc038907ee6dcea4d9d0e714'
     OR refund_row.secdef IS DISTINCT FROM TRUE
     OR refund_row.owner_name IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'STOP: refund RPC differs from reviewed Cloud';
  END IF;

  IF to_regprocedure('public.guard_payment_transaction_state()') IS NOT NULL
     OR to_regprocedure('public.guard_settlement_transaction_state()') IS NOT NULL
     OR to_regprocedure('public.guard_charge_transaction_state_review()') IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM pg_trigger t
       WHERE NOT t.tgisinternal AND t.tgname IN (
         'payments_transaction_state_guard_trigger',
         'charge_events_transaction_state_guard_trigger',
         'refunds_transaction_state_guard_trigger'
       )
     ) THEN
    RAISE EXCEPTION 'STOP: partial or existing settlement migration; do not replay';
  END IF;

  -- Refund Owner RPC needs INSERT+UPDATE to work even after checkout.
  -- Rely on current RLS, private table mutation ACL and audited RPC.
  IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid='public.finance_refunds'::regclass)
     OR has_table_privilege('authenticated','public.finance_refunds','INSERT')
     OR has_table_privilege('authenticated','public.finance_refunds','UPDATE')
     OR has_table_privilege('authenticated','public.finance_refunds','DELETE')
     OR has_table_privilege('anon','public.finance_refunds','INSERT')
     OR has_table_privilege('anon','public.finance_refunds','UPDATE')
     OR has_table_privilege('anon','public.finance_refunds','DELETE')
     OR NOT EXISTS (
       SELECT 1 FROM pg_trigger t
       WHERE t.tgrelid='public.finance_refunds'::regclass
         AND t.tgname='finance_refund_source_session_guard_trigger'
         AND t.tgenabled <> 'D' AND NOT t.tgisinternal
     ) THEN
    RAISE EXCEPTION 'STOP: refund ACL/RLS/source-session guard drift';
  END IF;
END;
$preflight$;

-- Each payment mutation locks its transaction; closed transactions are frozen.
CREATE FUNCTION public.guard_payment_transaction_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $guard$
DECLARE target_id uuid; tx_status public.transaction_status;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.transaction_id IS DISTINCT FROM OLD.transaction_id THEN
      RAISE EXCEPTION 'Pembayaran tidak dapat dipindahkan ke transaksi lain';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN
    target_id:=OLD.transaction_id;
  ELSE
    target_id:=NEW.transaction_id;
  END IF;
  SELECT t.status INTO tx_status FROM public.transactions t
  WHERE t.id=target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi pembayaran tidak ditemukan'; END IF;
  IF tx_status IN ('check_out','cancelled') THEN
    RAISE EXCEPTION 'Pembayaran tidak dapat diubah setelah transaksi ditutup atau dibatalkan';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$guard$;

CREATE TRIGGER payments_transaction_state_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.guard_payment_transaction_state();

-- Charge event mutations also lock TRX; do NOT attach this trigger to refunds.
CREATE FUNCTION public.guard_charge_transaction_state_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $guard$
DECLARE target_id uuid; tx_status public.transaction_status;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.transaction_id IS DISTINCT FROM OLD.transaction_id THEN
      RAISE EXCEPTION 'Charge tidak dapat dipindahkan ke transaksi lain';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN
    target_id:=OLD.transaction_id;
  ELSE
    target_id:=NEW.transaction_id;
  END IF;
  SELECT t.status INTO tx_status FROM public.transactions t
  WHERE t.id=target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi charge tidak ditemukan'; END IF;
  IF tx_status IN ('check_out','cancelled') THEN
    RAISE EXCEPTION 'Charge tidak dapat diubah setelah transaksi ditutup atau dibatalkan';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$guard$;

CREATE TRIGGER charge_events_transaction_state_guard_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_charge_events
FOR EACH ROW EXECUTE FUNCTION public.guard_charge_transaction_state_review();

-- Exact settlement under the same transaction-row lock as payment and
-- Owner-refund RPC; preserves original check-out -> dirty -> HK workflow.
CREATE OR REPLACE FUNCTION public.check_out_transaction(_transaction_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $checkout$
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
$checkout$;

-- Helpers are not RPCs. No broader table grants and NO refund trigger.
REVOKE ALL ON FUNCTION public.guard_payment_transaction_state() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_charge_transaction_state_review() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.check_out_transaction(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.check_out_transaction(uuid) TO authenticated;
COMMENT ON FUNCTION public.check_out_transaction(uuid) IS
  'Baturaden 25 Homestay: P0 review-only exact settlement; preserves Owner historical refund.';
COMMIT;
