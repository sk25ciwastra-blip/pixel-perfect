-- Disposable PostgreSQL 17 only — Baturaden 25 Homestay booking Owner controls.
-- Never run against Lovable Cloud.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;

CREATE TYPE public.app_role AS ENUM('owner','employee');
CREATE TYPE public.transaction_status AS ENUM('booking','check_in','check_out','cancelled');

CREATE TABLE public.rooms (
 id uuid PRIMARY KEY,
 active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.transactions (
 id uuid PRIMARY KEY,
 transaction_number text UNIQUE NOT NULL,
 status public.transaction_status NOT NULL DEFAULT 'booking',
 room_id uuid NOT NULL REFERENCES public.rooms(id),
 package_id uuid,
 scheduled_check_in timestamptz,
 scheduled_check_out timestamptz,
 started_at timestamptz,
 ends_at timestamptz,
 checked_out_at timestamptz,
 price_snapshot numeric NOT NULL DEFAULT 100000,
 day_mode text NOT NULL
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
REVOKE UPDATE ON public.transactions FROM PUBLIC,anon,authenticated;

CREATE TABLE public.payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 transaction_id uuid REFERENCES public.transactions(id),
 amount numeric NOT NULL,
 method text NOT NULL
);
CREATE TABLE public.activity_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid,
 action text NOT NULL,
 entity_type text NOT NULL,
 entity_id uuid,
 description text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.transactions,public.rooms,public.payments TO authenticated;

CREATE FUNCTION public.has_role(actor uuid,wanted public.app_role) RETURNS boolean
LANGUAGE sql STABLE AS $$
 SELECT wanted='owner'::public.app_role
 AND actor='00000000-0000-4000-8000-000000000001'::uuid
$$;
CREATE FUNCTION public.finance_training_is_restricted(actor uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.get_operational_day_mode(check_date date) RETURNS text
LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN extract(isodow FROM check_date) IN (6,7)
 THEN 'weekend' ELSE 'weekday' END
$$;
CREATE FUNCTION public.calculate_scheduled_booking_times(pkg uuid, desired timestamptz)
RETURNS TABLE(scheduled_check_in timestamptz,scheduled_check_out timestamptz)
LANGUAGE sql STABLE AS $$
 SELECT desired,desired+interval '2 hours'
$$;
CREATE FUNCTION public.check_in_booking(tx_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE actual text;
BEGIN
 SELECT transaction_number INTO actual FROM public.transactions
 WHERE id=tx_id AND status='booking' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not eligible'; END IF;
 UPDATE public.transactions SET status='check_in' WHERE id=tx_id;
 RETURN actual;
END;
$$;
CREATE FUNCTION public.create_reservation(
 mode text,room_id uuid,package_id uuid,person_name text,phone text,person_address text,
 amount numeric,method text,day_mode text,scheduled_check_in timestamptz,
 idempotency_key uuid,session_id uuid,guest_count integer
) RETURNS text LANGUAGE sql AS $$ SELECT 'synthetic only'::text $$;

INSERT INTO public.rooms(id,active)
SELECT ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, true
FROM generate_series(1,6) AS n;

-- TX1 past, paid; TX2 future, paid; TX3 future reschedulable;
-- TX4 future conflict for TX3 +7d; TX5 checkin; TX6 near deadline.
INSERT INTO public.transactions(
 id,transaction_number,status,room_id,package_id,
 scheduled_check_in,scheduled_check_out,started_at,ends_at,day_mode
)
SELECT
 ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'FIXBOOK-'||n,
 CASE WHEN n=5 THEN 'check_in' ELSE 'booking' END::public.transaction_status,
 ('10000000-0000-4000-8000-'||
   lpad((CASE WHEN n=4 OR n=5 THEN 3 ELSE n END)::text,12,'0'))::uuid,
 '30000000-0000-4000-8000-000000000001'::uuid,
 CASE WHEN n=1 THEN now()-interval '1 day'
      WHEN n=2 THEN now()+interval '8 hours'
      WHEN n=3 THEN now()+interval '5 days'
      WHEN n=4 THEN now()+interval '12 days'
      WHEN n=5 THEN now()+interval '20 days'
      ELSE now()+interval '1 hour' END,
 CASE WHEN n=1 THEN now()-interval '22 hours'
      WHEN n=2 THEN now()+interval '10 hours'
      WHEN n=3 THEN now()+interval '5 days 2 hours'
      WHEN n=4 THEN now()+interval '12 days 2 hours'
      WHEN n=5 THEN now()+interval '20 days 2 hours'
      ELSE now()+interval '3 hours' END,
 CASE WHEN n=5 THEN now()+interval '20 days' ELSE NULL END,
 CASE WHEN n=5 THEN now()+interval '20 days 2 hours' ELSE NULL END,
 public.get_operational_day_mode(
  (CASE WHEN n=1 THEN now()-interval '1 day'
      WHEN n=2 THEN now()+interval '8 hours'
      WHEN n=3 THEN now()+interval '5 days'
      WHEN n=4 THEN now()+interval '12 days'
      WHEN n=5 THEN now()+interval '20 days'
      ELSE now()+interval '1 hour' END AT TIME ZONE 'Asia/Jakarta')::date
 )
FROM generate_series(1,6) AS n;

INSERT INTO public.payments(transaction_id,amount,method)
VALUES
('20000000-0000-4000-8000-000000000001',40000,'Cash'),
('20000000-0000-4000-8000-000000000001',60000,'QRIS'),
('20000000-0000-4000-8000-000000000002',50000,'Transfer'),
('20000000-0000-4000-8000-000000000003',40000,'QRIS');
