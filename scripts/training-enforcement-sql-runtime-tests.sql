-- Local-only runtime fixture/tests. Intended for the isolated PostgreSQL test cluster.
-- No remote host, token, password, or connection string is used here.

INSERT INTO auth.users (id)
SELECT user_id FROM public.employees WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO auth.users (id)
SELECT user_id FROM public.user_roles WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO auth.users (id) VALUES
  ('00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000102'),
  ('00000000-0000-0000-0000-000000000103'),
  ('00000000-0000-0000-0000-000000000104')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (id, user_id, role) VALUES
  ('00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000000101', 'employee'),
  ('00000000-0000-0000-0000-000000001102', '00000000-0000-0000-0000-000000000102', 'employee'),
  ('00000000-0000-0000-0000-000000001103', '00000000-0000-0000-0000-000000000103', 'owner'),
  ('00000000-0000-0000-0000-000000001104', '00000000-0000-0000-0000-000000000104', 'employee')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.employees (employee_id, name, position, user_id, active) VALUES
  ('TEST-TRAINING-101', 'Training Trainee', 'receptionist', '00000000-0000-0000-0000-000000000101', true),
  ('TEST-TRAINING-102', 'Training Supervisor', 'supervisor', '00000000-0000-0000-0000-000000000102', true),
  ('TEST-TRAINING-104', 'Normal Receptionist', 'receptionist', '00000000-0000-0000-0000-000000000104', true)
ON CONFLICT (user_id) DO UPDATE
SET position = EXCLUDED.position, active = EXCLUDED.active;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

SELECT 'fixture-auth-users' AS check_name, count(*) AS value
FROM auth.users
WHERE id IN (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000104'
);

\echo 'SQL TEST: create assigned supervisor session'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.finance_cash_sessions
    WHERE opened_by = '00000000-0000-0000-0000-000000000102' AND status = 'OPEN'
  ) THEN
    INSERT INTO public.finance_cash_sessions (opened_by, operational_date, opening_cash, status)
    VALUES ('00000000-0000-0000-0000-000000000102', CURRENT_DATE, 0, 'OPEN');
  END IF;
END;
$$;
SELECT id AS assigned_session_id
FROM public.finance_cash_sessions
WHERE opened_by = '00000000-0000-0000-0000-000000000102' AND status = 'OPEN'
ORDER BY opened_at DESC
LIMIT 1 \gset

\echo 'SQL TEST: supervisor may create a two-day assignment'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000102';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.finance_training_assignments
    WHERE trainee_user_id = '00000000-0000-0000-0000-000000000101'
      AND status = 'ACTIVE'
  ) THEN
    PERFORM public.create_finance_training_assignment(
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000102',
      CURRENT_DATE
    );
  END IF;
END;
$$;
SELECT id AS assignment_id
FROM public.finance_training_assignments
WHERE trainee_user_id = '00000000-0000-0000-0000-000000000101'
  AND status = 'ACTIVE'
ORDER BY created_at DESC
LIMIT 1 \gset
COMMIT;

\echo 'PASS assignment-created'
SELECT status, starts_on, ends_on, label
FROM public.finance_training_assignments
WHERE id = :'assignment_id';

\echo 'SQL TEST: supervisor cannot assign another supervisor as owner of the session'
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000102';
DO $$
BEGIN
  BEGIN
    PERFORM public.create_finance_training_assignment(
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000103',
      CURRENT_DATE
    );
    RAISE EXCEPTION 'unexpected success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Supervisor hanya dapat menjadi penanggung jawab dirinya sendiri' THEN
      RAISE NOTICE 'PASS supervisor-assignment-boundary';
    ELSE
      RAISE;
    END IF;
  END;
END;
$$;
COMMIT;

\echo 'SQL TEST: active context uses assigned session'
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';
SELECT public.get_finance_training_context();
RESET ROLE;

\echo 'SQL TEST: trainee cannot open own session'
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';
DO $$
BEGIN
  BEGIN
    PERFORM public.open_finance_cash_session(0);
    RAISE EXCEPTION 'unexpected success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Akses ditolak%'
       OR SQLERRM LIKE 'Hanya Owner, Receptionist, atau Supervisor%'
       OR SQLERRM LIKE 'Peserta Training tidak boleh%' THEN
      RAISE NOTICE 'PASS trainee-open-session-denied';
    ELSE
      RAISE;
    END IF;
  END;
END;
$$;
RESET ROLE;

\echo 'SQL TEST: old check-out RPC is denied without assigned context'
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';
DO $$
BEGIN
  BEGIN
    PERFORM public.check_out_transaction('00000000-0000-0000-0000-000000009901');
    RAISE EXCEPTION 'unexpected success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Akses ditolak%' OR SQLERRM LIKE 'Peserta Training wajib%' THEN
      RAISE NOTICE 'PASS legacy-checkout-denied';
    ELSE
      RAISE;
    END IF;
  END;
END;
$$;
RESET ROLE;

\echo 'SQL TEST: old payment/expense/deposit RPCs are denied'
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';
DO $$
BEGIN
  BEGIN
    PERFORM public.record_transaction_payment(
      '00000000-0000-0000-0000-000000009902', 1, 'Cash',
      '00000000-0000-0000-0000-000000009903', NULL
    );
    RAISE EXCEPTION 'unexpected payment success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Akses ditolak%' OR SQLERRM LIKE 'Peserta Training%' THEN
      RAISE NOTICE 'PASS legacy-payment-denied';
    ELSE
      RAISE;
    END IF;
  END;
  BEGIN
    PERFORM public.record_finance_expense(
      '00000000-0000-0000-0000-000000009904', NULL, 1, 'Cash', 'test', 'test'
    );
    RAISE EXCEPTION 'unexpected expense success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Akses ditolak%' OR SQLERRM LIKE 'Peserta Training%' THEN
      RAISE NOTICE 'PASS legacy-expense-denied';
    ELSE
      RAISE;
    END IF;
  END;
  BEGIN
    PERFORM public.create_finance_deposit(
      '00000000-0000-0000-0000-000000009905', NULL, 'Cash', 1, NULL, ''
    );
    RAISE EXCEPTION 'unexpected deposit success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Akses ditolak%' OR SQLERRM LIKE 'Peserta Training%' THEN
      RAISE NOTICE 'PASS legacy-deposit-denied';
    ELSE
      RAISE;
    END IF;
  END;
END;
$$;
RESET ROLE;

\echo 'SQL TEST: old summary cannot read a trainee-owned legacy session'
RESET request.jwt.claim.sub;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.finance_cash_sessions
    WHERE opened_by = '00000000-0000-0000-0000-000000000101' AND status = 'OPEN'
  ) THEN
    INSERT INTO public.finance_cash_sessions (opened_by, operational_date, opening_cash, status)
    VALUES ('00000000-0000-0000-0000-000000000101', CURRENT_DATE, 0, 'OPEN');
  END IF;
END;
$$;
SELECT id AS legacy_session_id
FROM public.finance_cash_sessions
WHERE opened_by = '00000000-0000-0000-0000-000000000101' AND status = 'OPEN'
ORDER BY opened_at DESC
LIMIT 1 \gset
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';
DO $$
BEGIN
  BEGIN
    PERFORM public.get_finance_session_summary((
      SELECT id FROM public.finance_cash_sessions
      WHERE opened_by = auth.uid() AND status = 'OPEN'
      ORDER BY opened_at DESC LIMIT 1
    ));
    RAISE EXCEPTION 'unexpected summary success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Peserta Training hanya dapat melihat sesi kas penanggung jawab%' THEN
      RAISE NOTICE 'PASS legacy-summary-denied';
    ELSE
      RAISE;
    END IF;
  END;
END;
$$;
RESET ROLE;

\echo 'SQL TEST: normal receptionist remains an operator'
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000104';
SELECT public.finance_is_booking_operator(auth.uid()) AS normal_receptionist_operator;
RESET ROLE;

\echo 'SQL TEST: owner remains an operator'
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000103';
SELECT public.finance_is_booking_operator(auth.uid()) AS owner_operator;
RESET ROLE;

\echo 'SQL TEST: assigned session validity rejects wrong and closed sessions'
SELECT public.finance_training_session_is_valid(
  '00000000-0000-0000-0000-000000000101', :'assigned_session_id'
) AS assigned_session_valid;
UPDATE public.finance_cash_sessions
SET status = 'FINAL', closed_at = now()
WHERE id = :'assigned_session_id';
SELECT public.finance_training_session_is_valid(
  '00000000-0000-0000-0000-000000000101', :'assigned_session_id'
) AS closed_session_valid;

\echo 'SQL TEST FIXTURE: schema columns for transaction/check-out'
SELECT table_name, column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('transactions', 'rooms', 'guests', 'packages')
ORDER BY table_name, ordinal_position;

\echo 'SQL TEST: valid Training payment and check-out wrapper'
RESET request.jwt.claim.sub;
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.transactions'::regclass
  AND conname = 'transaction_number_format';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.finance_cash_sessions
    WHERE opened_by = '00000000-0000-0000-0000-000000000102' AND status = 'OPEN'
  ) THEN
    INSERT INTO public.finance_cash_sessions (opened_by, operational_date, opening_cash, status)
    VALUES ('00000000-0000-0000-0000-000000000102', CURRENT_DATE, 0, 'OPEN');
  END IF;
END;
$$;
SELECT opened_by, status, count(*)
FROM public.finance_cash_sessions
GROUP BY opened_by, status
ORDER BY opened_by, status;
SELECT id AS valid_session_id
FROM public.finance_cash_sessions
WHERE opened_by = '00000000-0000-0000-0000-000000000102' AND status = 'OPEN'
ORDER BY opened_at DESC
LIMIT 1 \gset

SELECT id AS test_room_id FROM public.rooms WHERE active AND status = 'ready' ORDER BY room_number LIMIT 1 \gset
INSERT INTO public.guests (full_name, address, phone)
SELECT 'Training Runtime Guest', 'Local Test', '081234567890'
WHERE NOT EXISTS (SELECT 1 FROM public.guests WHERE phone = '081234567890');
SELECT id AS test_guest_id FROM public.guests ORDER BY created_at LIMIT 1 \gset
SELECT id AS test_package_id FROM public.packages WHERE active ORDER BY created_at LIMIT 1 \gset

RESET request.jwt.claim.sub;
UPDATE public.rooms SET status = 'occupied' WHERE id = :'test_room_id';
INSERT INTO public.transactions (
  id, transaction_number, guest_id, room_id, package_id, status, created_by,
  price_snapshot, started_at, ends_at
)
VALUES (
  '00000000-0000-0000-0000-000000002001', 'BTRD25-000001', :'test_guest_id', :'test_room_id',
  :'test_package_id', 'check_in', '00000000-0000-0000-0000-000000000103',
  1000, now(), now() + interval '1 hour'
)
ON CONFLICT (id) DO NOTHING;

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';
SELECT public.record_training_transaction_payment(
  '00000000-0000-0000-0000-000000002001', 100,
  'Cash', '00000000-0000-0000-0000-000000002002', :'valid_session_id'
) AS training_payment_id;
SELECT public.check_out_training_transaction(
  '00000000-0000-0000-0000-000000002001', :'valid_session_id'
) AS training_checkout_number;
RESET ROLE;
RESET request.jwt.claim.sub;

SELECT status FROM public.transactions
WHERE id = '00000000-0000-0000-0000-000000002001';
SELECT count(*) AS training_audit_rows
FROM public.finance_training_audit
WHERE transaction_id = '00000000-0000-0000-0000-000000002001'
  AND label = 'Training'
  AND operator_id = '00000000-0000-0000-0000-000000000101'
  AND supervisor_id = '00000000-0000-0000-0000-000000000102'
  AND session_id = :'valid_session_id';

\echo 'SQL TEST: wrong assigned session rejected by wrapper'
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';
DO $$
BEGIN
  BEGIN
    PERFORM public.check_out_training_transaction(
      '00000000-0000-0000-0000-000000002001',
      (SELECT id FROM public.finance_cash_sessions
       WHERE opened_by = auth.uid() AND status = 'OPEN'
       ORDER BY opened_at DESC LIMIT 1)
    );
    RAISE EXCEPTION 'unexpected wrong-session success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Training wajib memakai sesi kas aktif penanggung jawab%' THEN
      RAISE NOTICE 'PASS wrong-session-wrapper-denied';
    ELSE
      RAISE;
    END IF;
  END;
END;
$$;
RESET ROLE;
RESET request.jwt.claim.sub;

\echo 'SQL TEST: direct audit insert cannot spoof label/operator'
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';
DO $$
BEGIN
  BEGIN
    INSERT INTO public.finance_training_audit (
      assignment_id, action, entity_type, session_id, operator_id, supervisor_id
    ) VALUES (
      '00000000-0000-0000-0000-000000001201', 'FORGED', 'transactions',
      '00000000-0000-0000-0000-000000001202',
      '00000000-0000-0000-0000-000000000103',
      '00000000-0000-0000-0000-000000000103'
    );
    RAISE EXCEPTION 'unexpected audit insert success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'permission denied%' OR SQLERRM LIKE 'new row violates%' THEN
      RAISE NOTICE 'PASS audit-spoof-denied';
    ELSE
      RAISE;
    END IF;
  END;
END;
$$;
RESET ROLE;
RESET request.jwt.claim.sub;
