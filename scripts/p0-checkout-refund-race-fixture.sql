-- Baturaden 25 Homestay - disposable PostgreSQL 17 concurrency fixtures ONLY.
-- Runs after existing synthetic fixture, actual Lovable refund RPC source and
-- the reviewed Checkout guard. No real guest/customer data involved.
\set ON_ERROR_STOP on
INSERT INTO public.rooms (id,status)
SELECT ('10000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,'occupied'
FROM generate_series(9,12) AS n;

INSERT INTO public.transactions
(id,transaction_number,room_id,status,price_snapshot,commission_mode_snapshot,commission_rate_snapshot)
SELECT ('20000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
       'FIXTURE-RACE-'||n,
       ('10000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
       'check_in',100000,'OFF',0
FROM generate_series(9,12) AS n;

INSERT INTO public.payments (transaction_id,amount,method)
SELECT ('20000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
       CASE WHEN n=11 THEN 70000 ELSE 100000 END,'Cash'
FROM generate_series(9,12) AS n;

-- Historical FINAL session is *not* the refund source; preserve its snapshot.
UPDATE public.payments
SET cash_session_id='30000000-0000-4000-8000-000000000001'
WHERE transaction_id IN (
  '20000000-0000-4000-8000-000000000009',
  '20000000-0000-4000-8000-000000000010',
  '20000000-0000-4000-8000-000000000011',
  '20000000-0000-4000-8000-000000000012'
);
