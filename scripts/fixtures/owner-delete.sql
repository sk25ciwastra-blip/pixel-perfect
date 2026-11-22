-- Synthetic fixture shape matches the columns and relationships used by Issue #99.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE ROLE authenticator LOGIN NOINHERIT;
GRANT anon, authenticated TO authenticator;
CREATE SCHEMA auth;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (auth.jwt()->>'sub')::uuid
$$;
CREATE FUNCTION public.fixture_id(_n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('00000000-0000-4000-8000-' || lpad(_n::text, 12, '0'))::uuid
$$;
CREATE TABLE auth.users (id uuid PRIMARY KEY, banned_until timestamptz);
CREATE TABLE auth.sessions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users, not_after timestamptz
);
CREATE TABLE auth.refresh_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id varchar(255) NOT NULL,
  session_id uuid REFERENCES auth.sessions ON DELETE CASCADE, revoked boolean NOT NULL DEFAULT false
);
CREATE TYPE public.app_role AS ENUM ('employee', 'owner');
CREATE TABLE public.user_roles (user_id uuid PRIMARY KEY, role public.app_role NOT NULL);
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE NOT NULL,
  employee_id text UNIQUE NOT NULL, active boolean NOT NULL DEFAULT true, photo_key text
);
CREATE TABLE public.rooms (id uuid PRIMARY KEY, status text NOT NULL);
CREATE SEQUENCE public.transaction_number_seq START 100;
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY, transaction_number text UNIQUE NOT NULL, status text NOT NULL,
  room_id uuid REFERENCES public.rooms, created_by uuid
);
CREATE TABLE public.finance_cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), opened_by uuid NOT NULL, status text NOT NULL
);
CREATE TABLE public.finance_training_assignments (
  trainee_user_id uuid NOT NULL, supervisor_user_id uuid NOT NULL, status text NOT NULL
);
CREATE TABLE public.payments (
  transaction_id uuid REFERENCES public.transactions, cash_session_id uuid REFERENCES public.finance_cash_sessions,
  recorded_by uuid, commission_recipient uuid
);
CREATE TABLE public.finance_refunds (transaction_id uuid REFERENCES public.transactions);
CREATE TABLE public.finance_charge_events (transaction_id uuid REFERENCES public.transactions);
CREATE TABLE public.payment_receipts (transaction_id uuid REFERENCES public.transactions);
CREATE TABLE public.finance_payment_batch_idempotency (transaction_id uuid REFERENCES public.transactions, transaction_number text);
CREATE TABLE public.finance_reservation_idempotency (transaction_id uuid REFERENCES public.transactions, transaction_number text);
CREATE TABLE public.housekeeping_jobs (transaction_id uuid REFERENCES public.transactions ON DELETE CASCADE);
CREATE TABLE public.housekeeping_history (transaction_id uuid REFERENCES public.transactions ON DELETE SET NULL, approval text);
CREATE TABLE public.housekeeping_checklists (transaction_id uuid REFERENCES public.transactions ON DELETE SET NULL, evidence text);
CREATE TABLE public.fixture_fk_rollback (transaction_id uuid REFERENCES public.transactions);
CREATE FUNCTION public.fixture_late_fk() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.id = public.fixture_id(33) THEN
    INSERT INTO public.fixture_fk_rollback VALUES (OLD.id);
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER fixture_late_fk BEFORE DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.fixture_late_fk();
GRANT SELECT, DELETE ON public.employees, public.transactions TO anon, authenticated;
GRANT UPDATE ON public.employees TO authenticated;

INSERT INTO auth.users SELECT fixture_id(n) FROM generate_series(1, 8) n;
INSERT INTO auth.sessions SELECT fixture_id(100 + n), fixture_id(n) FROM generate_series(1, 8) n;
INSERT INTO auth.refresh_tokens (user_id, session_id) VALUES
  (fixture_id(3)::text, fixture_id(103)), (fixture_id(3)::text, NULL), (fixture_id(4)::text, fixture_id(104));
INSERT INTO user_roles SELECT fixture_id(n), CASE WHEN n <= 2 THEN 'owner'::app_role ELSE 'employee'::app_role END FROM generate_series(1, 8) n;
INSERT INTO employees (id, user_id, employee_id, photo_key) VALUES
  (fixture_id(10),fixture_id(1),'B25EMP-10',NULL),
  (fixture_id(11),fixture_id(3),'B25EMP-11','fixture/photo'),
  (fixture_id(12),fixture_id(2),'B25EMP-12',NULL),
  (fixture_id(13),fixture_id(4),'B25EMP-13',NULL),
  (fixture_id(14),fixture_id(5),'B25EMP-14',NULL),
  (fixture_id(15),fixture_id(6),'B25EMP-15',NULL),
  (fixture_id(16),fixture_id(7),'B25EMP-16',NULL);
INSERT INTO rooms VALUES (fixture_id(50), 'cleaning');
INSERT INTO transactions
  SELECT fixture_id(n), 'BTRDTRX-' || n,
    CASE n WHEN 21 THEN 'booking' WHEN 22 THEN 'check_in' WHEN 23 THEN 'check_out' ELSE 'cancelled' END,
    fixture_id(50), CASE n WHEN 32 THEN fixture_id(7) ELSE fixture_id(1) END
  FROM generate_series(20, 33) n;
INSERT INTO finance_cash_sessions VALUES (fixture_id(40),fixture_id(4),'OPEN'), (fixture_id(41),fixture_id(6),'FINAL');
INSERT INTO finance_training_assignments VALUES (fixture_id(5),fixture_id(1),'ACTIVE');
INSERT INTO payments VALUES (fixture_id(23),fixture_id(40),fixture_id(4),NULL), (fixture_id(24),fixture_id(41),fixture_id(6),fixture_id(6));
INSERT INTO finance_refunds VALUES (fixture_id(25));
INSERT INTO payment_receipts VALUES (fixture_id(26));
INSERT INTO housekeeping_jobs VALUES (fixture_id(27));
INSERT INTO housekeeping_history VALUES (fixture_id(28), 'approved');
INSERT INTO housekeeping_checklists VALUES (fixture_id(29), 'fixture evidence');
INSERT INTO finance_reservation_idempotency VALUES (NULL, 'BTRDTRX-30');

CREATE FUNCTION public.protected_snapshot() RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'transactions', (SELECT jsonb_agg(t ORDER BY id) FROM transactions t WHERE id <> fixture_id(20)),
    'other_employees', (SELECT jsonb_agg(e ORDER BY id) FROM employees e WHERE id <> fixture_id(11)),
    'other_accounts', (SELECT jsonb_agg(u ORDER BY id) FROM auth.users u WHERE id <> fixture_id(3)),
    'other_tokens', (SELECT jsonb_agg(r ORDER BY id) FROM auth.refresh_tokens r WHERE user_id <> fixture_id(3)::text),
    'cash', (SELECT jsonb_agg(s ORDER BY id) FROM finance_cash_sessions s),
    'payments', (SELECT jsonb_agg(p ORDER BY transaction_id) FROM payments p),
    'refunds', (SELECT jsonb_agg(r ORDER BY transaction_id) FROM finance_refunds r),
    'receipts', (SELECT jsonb_agg(r ORDER BY transaction_id) FROM payment_receipts r),
    'room', (SELECT jsonb_agg(r ORDER BY id) FROM rooms r),
    'history', (SELECT jsonb_agg(h ORDER BY transaction_id) FROM housekeeping_history h),
    'jobs', (SELECT jsonb_agg(j ORDER BY transaction_id) FROM housekeeping_jobs j),
    'checklists', (SELECT jsonb_agg(c ORDER BY transaction_id) FROM housekeeping_checklists c),
    'numbering', (SELECT jsonb_build_array(last_value, is_called) FROM transaction_number_seq),
    'late_fk', (SELECT count(*) FROM fixture_fk_rollback)
  )
$$;
