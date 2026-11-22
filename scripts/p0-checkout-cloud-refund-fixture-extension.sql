-- Baturaden 25 Homestay: test-schema extension only.
-- Execute ONLY after p0-checkout-refund-disposable-fixture.sql and ONLY in
-- ephemeral PG17; enables the real 22-Nov Cloud refund FUNCTION body to compile.
-- Never copy real data or credentials from Cloud.

CREATE FUNCTION public.has_role(actor uuid, wanted text)
RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT wanted='owner'
  AND actor='00000000-0000-4000-8000-000000000001'::uuid $$;

ALTER TABLE public.transactions
  ADD COLUMN commission_mode_snapshot text,
  ADD COLUMN commission_rate_snapshot numeric;

ALTER TABLE public.payments
  ADD COLUMN cash_session_id uuid REFERENCES public.finance_cash_sessions(id),
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN commission_mode text,
  ADD COLUMN commission_rate numeric,
  ADD COLUMN commission_amount numeric DEFAULT 0;

ALTER TABLE public.finance_cash_sessions
  ADD COLUMN opening_cash numeric NOT NULL DEFAULT 0;

ALTER TABLE public.finance_refunds
  ADD COLUMN idempotency_key uuid UNIQUE,
  ADD COLUMN refund_method text NOT NULL DEFAULT 'CASH',
  ADD COLUMN reason text NOT NULL DEFAULT 'synthetic preceding refund',
  ADD COLUMN original_payment_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN created_by uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

CREATE TABLE public.finance_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.finance_cash_sessions(id),
  amount numeric NOT NULL,
  method text NOT NULL
);

CREATE TABLE public.finance_drawer_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_session_id uuid REFERENCES public.finance_cash_sessions(id),
  status text NOT NULL,
  actual_amount numeric NOT NULL DEFAULT 0
);

CREATE TABLE public.finance_refund_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL REFERENCES public.finance_refunds(id),
  payment_id uuid NOT NULL REFERENCES public.payments(id),
  refunded_amount numeric NOT NULL,
  original_commission numeric NOT NULL DEFAULT 0,
  adjusted_commission numeric NOT NULL DEFAULT 0,
  commission_delta numeric NOT NULL DEFAULT 0
);

-- An authorized OPEN source with real available opening cash.
UPDATE public.finance_cash_sessions
SET opening_cash=200000
WHERE id='30000000-0000-4000-8000-000000000002';

-- An explicit PERCENTAGE snapshot and an explicit PER_ROOM snapshot, with
-- payments, separate physical rooms and no real customer identity.
INSERT INTO public.rooms(id,status) VALUES
('10000000-0000-4000-8000-000000000006','occupied'),
('10000000-0000-4000-8000-000000000007','occupied'),
('10000000-0000-4000-8000-000000000008','occupied');

INSERT INTO public.transactions(
  id,transaction_number,room_id,status,price_snapshot,
  commission_mode_snapshot,commission_rate_snapshot
) VALUES
('20000000-0000-4000-8000-000000000006','FIXTURE-PERCENT',
 '10000000-0000-4000-8000-000000000006','check_in',100000,'PERCENTAGE',10),
('20000000-0000-4000-8000-000000000007','FIXTURE-PER-ROOM',
 '10000000-0000-4000-8000-000000000007','check_in',100000,'PER_ROOM',5000),
('20000000-0000-4000-8000-000000000008','FIXTURE-PRE-REFUND',
 '10000000-0000-4000-8000-000000000008','check_in',100000,'PERCENTAGE',10);

INSERT INTO public.payments(transaction_id,amount,commission_mode,commission_rate,commission_amount)
VALUES
('20000000-0000-4000-8000-000000000006',100000,'PERCENTAGE',10,10000),
('20000000-0000-4000-8000-000000000007',100000,'PER_ROOM',5000,5000),
('20000000-0000-4000-8000-000000000008',100000,'PERCENTAGE',10,10000);

-- Note: UPDATEs here are confined to ephemeral fixture, never Cloud.
