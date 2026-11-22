-- Baturaden 25 Homestay: disposable PostgreSQL 17 fixture ONLY.
-- No connection to Lovable Cloud or any Supabase project.
-- This deliberately mocks the old Checkout and Owner Refund functions.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid$$;

CREATE TYPE public.transaction_status AS ENUM
('booking','check_in','check_out','cancelled');

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY,
  status text NOT NULL
);
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY,
  transaction_number text UNIQUE NOT NULL,
  room_id uuid REFERENCES public.rooms(id) NOT NULL,
  status public.transaction_status NOT NULL,
  price_snapshot numeric NOT NULL,
  checked_out_at timestamptz
);
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.transactions(id) NOT NULL,
  amount numeric NOT NULL,
  method text NOT NULL DEFAULT 'Cash'
);
CREATE TABLE public.finance_charge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.transactions(id) NOT NULL,
  amount numeric NOT NULL
);
CREATE TABLE public.finance_cash_sessions (
  id uuid PRIMARY KEY,
  status text NOT NULL
);
CREATE TABLE public.finance_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.transactions(id) NOT NULL,
  amount numeric NOT NULL,
  source_type text NOT NULL,
  source_session_id uuid REFERENCES public.finance_cash_sessions(id),
  commission_adjustment numeric NOT NULL DEFAULT 0
);
CREATE TABLE public.activity_logs (
  id bigint GENERATED ALWAYS AS IDENTITY,
  user_id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  description text
);

CREATE FUNCTION public.can_frontdesk(actor uuid)
RETURNS boolean LANGUAGE sql STABLE
AS $$SELECT actor IN ('00000000-0000-4000-8000-000000000001'::uuid)$$;

-- Baseline Checkout mock deliberately lacks settlement math, like Cloud old body.
-- The reviewed migration will replace it.
CREATE FUNCTION public.check_out_transaction(_transaction_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='public'
AS $$
DECLARE rec record;
BEGIN
  IF NOT public.can_frontdesk(auth.uid()) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT * INTO rec FROM public.transactions WHERE id=_transaction_id FOR UPDATE;
  IF NOT FOUND OR rec.status <> 'check_in' THEN RAISE EXCEPTION 'Transaksi bukan CHECK-IN'; END IF;
  UPDATE public.rooms SET status='dirty' WHERE id=rec.room_id AND status='occupied';
  UPDATE public.transactions SET status='check_out',checked_out_at=now() WHERE id=rec.id;
  RETURN rec.transaction_number;
END;$$;
REVOKE ALL ON FUNCTION public.check_out_transaction(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.check_out_transaction(uuid) TO authenticated;

CREATE FUNCTION public.finance_refund_source_session_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public'
AS $$
BEGIN
  IF NEW.source_session_id IS NOT NULL
     AND (SELECT s.status FROM public.finance_cash_sessions s WHERE s.id=NEW.source_session_id) IS DISTINCT FROM 'OPEN' THEN
    RAISE EXCEPTION 'Sumber dana refund harus dari sesi OPEN';
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER finance_refund_source_session_guard_trigger
BEFORE INSERT ON public.finance_refunds
FOR EACH ROW EXECUTE FUNCTION public.finance_refund_source_session_guard();

-- Synthetic mock of Owner-only refund RPC, including row lock and INSERT+UPDATE
-- after Checkout. Actual Cloud refund logic is richer and is NOT tested here.
CREATE FUNCTION public.create_finance_refund(
  _idempotency_key uuid, _transaction_id uuid, _amount numeric,
  _refund_method text, _source_type text, _source_session_id uuid,
  _reason text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='public'
AS $$
DECLARE saved_id uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM '00000000-0000-4000-8000-000000000001'::uuid THEN
    RAISE EXCEPTION 'Hanya Owner yang dapat melakukan refund';
  END IF;
  PERFORM 1 FROM public.transactions WHERE id=_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRX refund tidak ada'; END IF;
  IF _source_type NOT IN ('OWNER_FUNDS','SHIFT_CASH') THEN RAISE EXCEPTION 'Sumber tak valid'; END IF;
  IF (_source_type='OWNER_FUNDS' AND _source_session_id IS NOT NULL)
     OR (_source_type='SHIFT_CASH' AND _source_session_id IS NULL) THEN
    RAISE EXCEPTION 'Sumber dan sesi tidak cocok';
  END IF;
  INSERT INTO public.finance_refunds(transaction_id,amount,source_type,source_session_id)
  VALUES(_transaction_id,_amount,_source_type,_source_session_id)
  RETURNING id INTO saved_id;
  UPDATE public.finance_refunds SET commission_adjustment=-1 WHERE id=saved_id;
  RETURN saved_id;
END;$$;

REVOKE ALL ON FUNCTION public.create_finance_refund(uuid,uuid,numeric,text,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_finance_refund(uuid,uuid,numeric,text,text,uuid,text) TO authenticated;
ALTER TABLE public.finance_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_refunds FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.finance_refunds FROM PUBLIC,anon,authenticated;

-- Deterministic synthetic records, not copies of any guest data.
INSERT INTO public.finance_cash_sessions(id,status) VALUES
('30000000-0000-4000-8000-000000000001','FINAL'),
('30000000-0000-4000-8000-000000000002','OPEN');
INSERT INTO public.rooms(id,status)
SELECT ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'occupied'
FROM generate_series(1,5) n;
INSERT INTO public.transactions(id,transaction_number,room_id,status,price_snapshot)
SELECT ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       'FIXTURE-'||n,
       ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       'check_in',100
FROM generate_series(1,5) n;
INSERT INTO public.payments(transaction_id,amount)
VALUES
('20000000-0000-4000-8000-000000000001',100),
('20000000-0000-4000-8000-000000000002',40),
('20000000-0000-4000-8000-000000000003',110),
('20000000-0000-4000-8000-000000000004',100),
('20000000-0000-4000-8000-000000000005',100);
INSERT INTO public.finance_charge_events(transaction_id,amount)
VALUES('20000000-0000-4000-8000-000000000004',10);
INSERT INTO public.finance_refunds(transaction_id,amount,source_type)
VALUES('20000000-0000-4000-8000-000000000005',10,'OWNER_FUNDS');
