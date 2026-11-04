\set ON_ERROR_STOP on
\echo 'COMBINED PAYMENT AUTHORIZATION RUNTIME TESTS — LOCAL ISOLATED PostgreSQL ONLY'

BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

-- Fixture identities: Owner 111, Receptionist 222, Supervisor 102,
-- Training Day 1 trainee 101, Training Day 2 trainee 105, unauthorized HK 106.
INSERT INTO auth.users (id) VALUES
  ('00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000102'),
  ('00000000-0000-0000-0000-000000000105'),
  ('00000000-0000-0000-0000-000000000106')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (id, user_id, role) VALUES
  ('00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000000101', 'employee'),
  ('00000000-0000-0000-0000-000000001102', '00000000-0000-0000-0000-000000000102', 'employee'),
  ('00000000-0000-0000-0000-000000001105', '00000000-0000-0000-0000-000000000105', 'employee'),
  ('00000000-0000-0000-0000-000000001106', '00000000-0000-0000-0000-000000000106', 'employee')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.employees (employee_id, name, position, user_id, active) VALUES
  ('AUTH-TRAINING-101', 'Authorization Training Day 1', 'receptionist', '00000000-0000-0000-0000-000000000101', true),
  ('AUTH-SUPERVISOR-102', 'Authorization Supervisor', 'supervisor', '00000000-0000-0000-0000-000000000102', true),
  ('AUTH-TRAINING-105', 'Authorization Training Day 2', 'receptionist', '00000000-0000-0000-0000-000000000105', true),
  ('AUTH-HK-106', 'Authorization Housekeeping', 'housekeeping', '00000000-0000-0000-0000-000000000106', true)
ON CONFLICT (user_id) DO UPDATE
SET position = EXCLUDED.position, active = EXCLUDED.active;

CREATE TEMP TABLE authz_results (
  id bigserial PRIMARY KEY,
  scenario text NOT NULL,
  status text NOT NULL CHECK (status IN ('PASS', 'FAIL', 'NOT TESTED')),
  detail text NOT NULL
);

CREATE TEMP TABLE authz_context (
  key text PRIMARY KEY,
  value uuid NOT NULL
);

GRANT SELECT ON TABLE authz_results TO authenticated;

CREATE OR REPLACE FUNCTION pg_temp.authz_result(_scenario text, _status text, _detail text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO pg_temp.authz_results(scenario, status, detail)
  VALUES (_scenario, _status, _detail);
$$;

CREATE OR REPLACE FUNCTION pg_temp.authz_put(_key text, _value uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO pg_temp.authz_context(key, value)
  VALUES (_key, _value)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
$$;

CREATE OR REPLACE FUNCTION pg_temp.authz_get(_key text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM pg_temp.authz_context WHERE key = _key;
$$;

CREATE OR REPLACE FUNCTION pg_temp.authz_price(_room_number text, _package_name text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE public.get_operational_day_mode((now() AT TIME ZONE 'Asia/Jakarta')::date)
    WHEN 'weekday' THEN pr.weekday_price ELSE pr.weekend_price END
  FROM public.rooms r
  JOIN public.room_types rt ON rt.id = r.room_type_id
  JOIN public.packages p ON p.name = _package_name AND p.active
  JOIN public.package_room_type_prices pr
    ON pr.package_id = p.id AND pr.pricing_group = rt.pricing_group
  WHERE r.room_number = _room_number AND r.active
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION pg_temp.authz_room(_room_number text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.rooms WHERE room_number = _room_number AND active LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION pg_temp.authz_package(_package_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.packages WHERE name = _package_name AND active LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION pg_temp.authz_snapshot(_request_id uuid, _phone text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'guests', (SELECT count(*) FROM public.guests g WHERE g.phone = _phone),
    'transactions', (SELECT count(*) FROM public.transactions t JOIN public.guests g ON g.id = t.guest_id WHERE g.phone = _phone),
    'payments', (SELECT count(*) FROM public.payments p JOIN public.transactions t ON t.id = p.transaction_id JOIN public.guests g ON g.id = t.guest_id WHERE g.phone = _phone),
    'batches', (SELECT count(*) FROM public.finance_payment_batch_idempotency b WHERE b.request_idempotency_key = _request_id),
    'audits', (SELECT count(*) FROM public.finance_training_audit a WHERE a.transaction_id IN (SELECT t.id FROM public.transactions t JOIN public.guests g ON g.id = t.guest_id WHERE g.phone = _phone))
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.authz_payment_count(_transaction_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM public.payments WHERE transaction_id = _transaction_id;
$$;

CREATE OR REPLACE FUNCTION pg_temp.authz_session_count(_opened_by uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM public.finance_cash_sessions WHERE opened_by = _opened_by;
$$;

CREATE OR REPLACE FUNCTION pg_temp.authz_training_audit_count(
  _transaction_id uuid, _operator_id uuid, _supervisor_id uuid, _session_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)
  FROM public.finance_training_audit
  WHERE transaction_id = _transaction_id
    AND label = 'Training'
    AND operator_id = _operator_id
    AND supervisor_id = _supervisor_id
    AND session_id = _session_id;
$$;

-- Exercise the explicit authenticated ACL, while all fixture writes above remain local-only.
SET LOCAL ROLE authenticated;

\echo 'SETUP — Owner, Receptionist, Supervisor sessions and two Training assignments'
DO $$
DECLARE
  owner_id constant uuid := '11111111-1111-4111-8111-111111111111';
  receptionist_id constant uuid := '22222222-2222-4222-8222-222222222222';
  supervisor_id constant uuid := '00000000-0000-0000-0000-000000000102';
  trainee_day1 constant uuid := '00000000-0000-0000-0000-000000000101';
  trainee_day2 constant uuid := '00000000-0000-0000-0000-000000000105';
  owner_session uuid;
  receptionist_session uuid;
  supervisor_session uuid;
  assignment_day1 uuid;
  assignment_day2 uuid;
  local_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  PERFORM set_config('app.finance_training_session_id', '', true);

  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  SELECT public.open_finance_cash_session(0) INTO owner_session;
  PERFORM pg_temp.authz_put('owner_session', owner_session);

  PERFORM set_config('request.jwt.claim.sub', receptionist_id::text, true);
  SELECT public.open_finance_cash_session(0) INTO receptionist_session;
  PERFORM pg_temp.authz_put('receptionist_session', receptionist_session);

  PERFORM set_config('request.jwt.claim.sub', supervisor_id::text, true);
  SELECT public.open_finance_cash_session(0) INTO supervisor_session;
  PERFORM pg_temp.authz_put('supervisor_session', supervisor_session);

  SELECT public.create_finance_training_assignment(trainee_day1, supervisor_id, local_today)
  INTO assignment_day1;
  PERFORM pg_temp.authz_put('assignment_day1', assignment_day1);

  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  SELECT public.create_finance_training_assignment(trainee_day2, supervisor_id, local_today - 1)
  INTO assignment_day2;
  PERFORM pg_temp.authz_put('assignment_day2', assignment_day2);
END;
$$;

\echo 'ACL — authenticated may execute; anon has no combined/Training execute'
DO $$
DECLARE
  combined_reservation text := 'public.create_reservation_combined(text,uuid,uuid,text,text,text,jsonb,text,timestamptz,uuid,text,uuid,integer)';
  combined_payment text := 'public.record_transaction_payment_combined(uuid,jsonb,uuid,text,uuid)';
  training_reservation text := 'public.create_training_reservation_combined(text,uuid,uuid,text,text,text,jsonb,text,timestamptz,uuid,text,uuid,integer)';
  training_payment text := 'public.record_training_transaction_payment_combined(uuid,jsonb,uuid,text,uuid)';
BEGIN
  IF NOT has_function_privilege('authenticated', combined_reservation, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', combined_payment, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', training_reservation, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', training_payment, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated execute grant missing';
  END IF;
  IF has_function_privilege('anon', combined_reservation, 'EXECUTE')
     OR has_function_privilege('anon', combined_payment, 'EXECUTE')
     OR has_function_privilege('anon', training_reservation, 'EXECUTE')
     OR has_function_privilege('anon', training_payment, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon execute grant unexpectedly present';
  END IF;
  PERFORM pg_temp.authz_result('ACL combined and Training RPC grants', 'PASS', 'authenticated=EXECUTE; anon=DENIED');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.authz_result('ACL combined and Training RPC grants', 'FAIL', SQLERRM);
END;
$$;

\echo 'OWNER — combined reservation succeeds on Owner-owned session'
DO $$
DECLARE
  owner_id constant uuid := '11111111-1111-4111-8111-111111111111';
  room_id uuid := pg_temp.authz_room('02');
  package_id uuid;
  session_id uuid := pg_temp.authz_get('owner_session');
  result jsonb;
  tx_id uuid;
  total numeric := pg_temp.authz_price('02', 'Paket 24 Jam');
  first_amount numeric;
  second_amount numeric;
  phone text := '081911111101';
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
    PERFORM set_config('app.finance_training_session_id', '', true);
    package_id := pg_temp.authz_package('Paket 24 Jam');
    first_amount := floor(total / 2); second_amount := total - first_amount;
    result := public.create_reservation_combined(
      'check_in', room_id, package_id, 'Authorization Owner', phone, 'Auth Test',
      jsonb_build_array(
        jsonb_build_object('method', 'QRIS', 'amount', first_amount, 'idempotency_key', '30111111-1111-4111-8111-111111111111'::uuid),
        jsonb_build_object('method', 'Cash', 'amount', second_amount, 'idempotency_key', '30111111-1111-4111-8111-111111111112'::uuid)
      ), 'weekday', NULL, '30211111-1111-4111-8111-111111111111'::uuid, 'auth-owner-v1', session_id, 2
    );
    tx_id := (result->>'transaction_id')::uuid;
    IF (SELECT count(*) FROM public.payments WHERE transaction_id = tx_id) <> 2
       OR (SELECT count(*) FROM public.payments WHERE transaction_id = tx_id AND recorded_by = owner_id) <> 2
       OR (SELECT count(*) FROM public.payments WHERE transaction_id = tx_id AND cash_session_id = session_id) <> 2 THEN
      RAISE EXCEPTION 'Owner operator/session linkage mismatch';
    END IF;
    PERFORM pg_temp.authz_put('owner_tx', tx_id);
    PERFORM pg_temp.authz_result('Owner combined reservation', 'PASS', format('two payments; operator=%s; session_owner=%s', owner_id, (SELECT opened_by FROM public.finance_cash_sessions WHERE id = session_id)));
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.authz_result('Owner combined reservation', 'FAIL', SQLERRM);
  END;
END;
$$;

\echo 'SUPERVISOR — helps active Receptionist session without identity swap'
DO $$
DECLARE
  supervisor_id constant uuid := '00000000-0000-0000-0000-000000000102';
  receptionist_id constant uuid := '22222222-2222-4222-8222-222222222222';
  room_id uuid := pg_temp.authz_room('03');
  package_id uuid;
  session_id uuid := pg_temp.authz_get('receptionist_session');
  result jsonb;
  tx_id uuid;
  total numeric := pg_temp.authz_price('03', 'Paket 24 Jam');
  first_amount numeric;
  second_amount numeric;
  phone text := '081911111102';
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', supervisor_id::text, true);
    PERFORM set_config('app.finance_training_session_id', '', true);
    package_id := pg_temp.authz_package('Paket 24 Jam');
    first_amount := floor(total / 2); second_amount := total - first_amount;
    result := public.create_reservation_combined(
      'check_in', room_id, package_id, 'Authorization Supervisor', phone, 'Auth Test',
      jsonb_build_array(
        jsonb_build_object('method', 'QRIS', 'amount', first_amount, 'idempotency_key', '30333333-3333-4333-8333-333333333331'::uuid),
        jsonb_build_object('method', 'Cash', 'amount', second_amount, 'idempotency_key', '30333333-3333-4333-8333-333333333332'::uuid)
      ), 'weekday', NULL, '30433333-3333-4333-8333-333333333333'::uuid, 'auth-supervisor-v1', session_id, 2
    );
    tx_id := (result->>'transaction_id')::uuid;
    IF (SELECT opened_by FROM public.finance_cash_sessions WHERE id = session_id) <> receptionist_id
       OR (SELECT count(*) FROM public.payments WHERE transaction_id = tx_id AND recorded_by = supervisor_id) <> 2
       OR (SELECT count(*) FROM public.payments WHERE transaction_id = tx_id AND cash_session_id = session_id) <> 2 THEN
      RAISE EXCEPTION 'Supervisor assistance swapped session owner/operator';
    END IF;
    PERFORM pg_temp.authz_put('supervisor_tx', tx_id);
    PERFORM pg_temp.authz_result('Supervisor assists Receptionist session', 'PASS', format('operator=%s; session_owner=%s', supervisor_id, receptionist_id));
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.authz_result('Supervisor assists Receptionist session', 'FAIL', SQLERRM);
  END;
END;
$$;

\echo 'RECEPTIONIST — normal Receptionist combined reservation succeeds'
DO $$
DECLARE
  receptionist_id constant uuid := '22222222-2222-4222-8222-222222222222';
  room_id uuid := pg_temp.authz_room('04');
  package_id uuid;
  session_id uuid := pg_temp.authz_get('receptionist_session');
  result jsonb;
  tx_id uuid;
  total numeric := pg_temp.authz_price('04', 'Paket 24 Jam');
  first_amount numeric;
  second_amount numeric;
  phone text := '081911111103';
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', receptionist_id::text, true);
    PERFORM set_config('app.finance_training_session_id', '', true);
    package_id := pg_temp.authz_package('Paket 24 Jam');
    first_amount := floor(total / 2); second_amount := total - first_amount;
    result := public.create_reservation_combined(
      'check_in', room_id, package_id, 'Authorization Receptionist', phone, 'Auth Test',
      jsonb_build_array(
        jsonb_build_object('method', 'QRIS', 'amount', first_amount, 'idempotency_key', '30555555-5555-4555-8555-555555555551'::uuid),
        jsonb_build_object('method', 'Cash', 'amount', second_amount, 'idempotency_key', '30555555-5555-4555-8555-555555555552'::uuid)
      ), 'weekday', NULL, '30655555-5555-4555-8555-555555555555'::uuid, 'auth-receptionist-v1', session_id, 2
    );
    tx_id := (result->>'transaction_id')::uuid;
    IF (SELECT count(*) FROM public.payments WHERE transaction_id = tx_id AND recorded_by = receptionist_id) <> 2 THEN
      RAISE EXCEPTION 'Receptionist payment operator mismatch';
    END IF;
    PERFORM pg_temp.authz_put('receptionist_tx', tx_id);
    PERFORM pg_temp.authz_result('Receptionist combined reservation', 'PASS', format('two payments; operator=%s; session=%s', receptionist_id, session_id));
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.authz_result('Receptionist combined reservation', 'FAIL', SQLERRM);
  END;
END;
$$;

\echo 'TRAINING DAY 1 — active context, combined wrapper, audit'
DO $$
DECLARE
  trainee_id constant uuid := '00000000-0000-0000-0000-000000000101';
  supervisor_id constant uuid := '00000000-0000-0000-0000-000000000102';
  session_id uuid := pg_temp.authz_get('supervisor_session');
  room_id uuid := pg_temp.authz_room('06');
  package_id uuid;
  result jsonb;
  context jsonb;
  tx_id uuid;
  total numeric := pg_temp.authz_price('06', 'Paket 24 Jam');
  first_amount numeric;
  second_amount numeric;
  phone text := '081911111104';
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', trainee_id::text, true);
    PERFORM set_config('app.finance_training_session_id', '', true);
    context := public.get_finance_training_context();
    IF context->>'status' <> 'ACTIVE' OR context->>'can_transact' <> 'true' OR (context->>'session_id')::uuid <> session_id THEN
      RAISE EXCEPTION 'Day 1 context mismatch: %', context;
    END IF;
    package_id := pg_temp.authz_package('Paket 24 Jam');
    first_amount := floor(total / 2); second_amount := total - first_amount;
    result := public.create_training_reservation_combined(
      'check_in', room_id, package_id, 'Authorization Training Day 1', phone, 'Auth Training',
      jsonb_build_array(
        jsonb_build_object('method', 'QRIS', 'amount', first_amount, 'idempotency_key', '30777777-7777-4777-8777-777777777771'::uuid),
        jsonb_build_object('method', 'Cash', 'amount', second_amount, 'idempotency_key', '30777777-7777-4777-8777-777777777772'::uuid)
      ), 'weekday', NULL, '30877777-7777-4777-8777-777777777777'::uuid, 'auth-training-day1-v1', session_id, 2
    );
    tx_id := (result->>'transaction_id')::uuid;
    IF (SELECT count(*) FROM public.payments WHERE transaction_id = tx_id AND recorded_by = trainee_id AND cash_session_id = session_id) <> 2
       OR pg_temp.authz_training_audit_count(tx_id, trainee_id, supervisor_id, session_id) < 3 THEN
      RAISE EXCEPTION 'Day 1 payment/audit mismatch';
    END IF;
    PERFORM pg_temp.authz_put('training_day1_tx', tx_id);
    PERFORM pg_temp.authz_result('Training Day 1 combined wrapper + audit', 'PASS', format('operator=%s; supervisor=%s; two payments; audit_rows>=%s', trainee_id, supervisor_id, 3));
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.authz_result('Training Day 1 combined wrapper + audit', 'FAIL', SQLERRM);
  END;
END;
$$;

\echo 'TRAINING DAY 2 — active context, combined wrapper, audit'
DO $$
DECLARE
  trainee_id constant uuid := '00000000-0000-0000-0000-000000000105';
  supervisor_id constant uuid := '00000000-0000-0000-0000-000000000102';
  session_id uuid := pg_temp.authz_get('supervisor_session');
  room_id uuid := pg_temp.authz_room('07');
  package_id uuid;
  result jsonb;
  context jsonb;
  tx_id uuid;
  total numeric := pg_temp.authz_price('07', 'Paket 24 Jam');
  first_amount numeric;
  second_amount numeric;
  phone text := '081911111105';
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', trainee_id::text, true);
    PERFORM set_config('app.finance_training_session_id', '', true);
    context := public.get_finance_training_context();
    IF context->>'status' <> 'ACTIVE' OR context->>'can_transact' <> 'true' OR (context->>'session_id')::uuid <> session_id THEN
      RAISE EXCEPTION 'Day 2 context mismatch: %', context;
    END IF;
    package_id := pg_temp.authz_package('Paket 24 Jam');
    first_amount := floor(total / 2); second_amount := total - first_amount;
    result := public.create_training_reservation_combined(
      'check_in', room_id, package_id, 'Authorization Training Day 2', phone, 'Auth Training',
      jsonb_build_array(
        jsonb_build_object('method', 'QRIS', 'amount', first_amount, 'idempotency_key', '30999999-9999-4999-8999-999999999991'::uuid),
        jsonb_build_object('method', 'Cash', 'amount', second_amount, 'idempotency_key', '30999999-9999-4999-8999-999999999992'::uuid)
      ), 'weekday', NULL, '31099999-9999-4999-8999-999999999999'::uuid, 'auth-training-day2-v1', session_id, 2
    );
    tx_id := (result->>'transaction_id')::uuid;
    IF (SELECT count(*) FROM public.payments WHERE transaction_id = tx_id AND recorded_by = trainee_id AND cash_session_id = session_id) <> 2
       OR pg_temp.authz_training_audit_count(tx_id, trainee_id, supervisor_id, session_id) < 3 THEN
      RAISE EXCEPTION 'Day 2 payment/audit mismatch';
    END IF;
    PERFORM pg_temp.authz_put('training_day2_tx', tx_id);
    PERFORM pg_temp.authz_result('Training Day 2 combined wrapper + audit', 'PASS', format('operator=%s; supervisor=%s; two payments; audit_rows>=%s', trainee_id, supervisor_id, 3));
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.authz_result('Training Day 2 combined wrapper + audit', 'FAIL', SQLERRM);
  END;
END;
$$;

\echo 'DENY — Training direct combined RPC without wrapper is atomic'
DO $$
DECLARE
  trainee_id constant uuid := '00000000-0000-0000-0000-000000000101';
  session_id uuid := pg_temp.authz_get('supervisor_session');
  room_id uuid := pg_temp.authz_room('08');
  package_id uuid;
  total numeric := pg_temp.authz_price('08', 'Paket 24 Jam');
  first_amount numeric;
  second_amount numeric;
  request_id uuid := '31111111-1111-4111-8111-111111111111';
  phone text := '081911111106';
  before jsonb;
  after jsonb;
  rejected boolean := false;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', trainee_id::text, true);
    PERFORM set_config('app.finance_training_session_id', '', true);
    before := pg_temp.authz_snapshot(request_id, phone);
    package_id := pg_temp.authz_package('Paket 24 Jam');
    first_amount := floor(total / 2); second_amount := total - first_amount;
    BEGIN
      PERFORM public.create_reservation_combined(
        'check_in', room_id, package_id, 'Training Direct Illegal', phone, 'Auth Training',
        jsonb_build_array(
          jsonb_build_object('method', 'QRIS', 'amount', first_amount, 'idempotency_key', '31211111-1111-4111-8111-111111111111'::uuid),
          jsonb_build_object('method', 'Cash', 'amount', second_amount, 'idempotency_key', '31211111-1111-4111-8111-111111111112'::uuid)
        ), 'weekday', NULL, request_id, 'auth-training-direct-illegal', session_id, 2
      );
    EXCEPTION WHEN OTHERS THEN
      rejected := true;
    END;
    after := pg_temp.authz_snapshot(request_id, phone);
    IF NOT rejected OR after <> before THEN
      RAISE EXCEPTION 'direct Training combined RPC was accepted or left rows: before %, after %', before, after;
    END IF;
    PERFORM pg_temp.authz_result('Training direct combined RPC denied atomically', 'PASS', 'wrapper required; no guest/transaction/payment/batch/audit rows');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.authz_result('Training direct combined RPC denied atomically', 'FAIL', SQLERRM);
  END;
END;
$$;

\echo 'DENY — Training wrapper rejects Owner-owned session atomically'
DO $$
DECLARE
  trainee_id constant uuid := '00000000-0000-0000-0000-000000000101';
  session_id uuid := pg_temp.authz_get('owner_session');
  room_id uuid := pg_temp.authz_room('09');
  package_id uuid;
  total numeric := pg_temp.authz_price('09', 'Paket 24 Jam');
  first_amount numeric;
  second_amount numeric;
  request_id uuid := '31333333-3333-4333-8333-333333333333';
  phone text := '081911111107';
  before jsonb;
  after jsonb;
  rejected boolean := false;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', trainee_id::text, true);
    PERFORM set_config('app.finance_training_session_id', '', true);
    before := pg_temp.authz_snapshot(request_id, phone);
    package_id := pg_temp.authz_package('Paket 24 Jam');
    first_amount := floor(total / 2); second_amount := total - first_amount;
    BEGIN
      PERFORM public.create_training_reservation_combined(
        'check_in', room_id, package_id, 'Training Wrong Session', phone, 'Auth Training',
        jsonb_build_array(
          jsonb_build_object('method', 'QRIS', 'amount', first_amount, 'idempotency_key', '31433333-3333-4333-8333-333333333331'::uuid),
          jsonb_build_object('method', 'Cash', 'amount', second_amount, 'idempotency_key', '31433333-3333-4333-8333-333333333332'::uuid)
        ), 'weekday', NULL, request_id, 'auth-training-wrong-session', session_id, 2
      );
    EXCEPTION WHEN OTHERS THEN
      rejected := true;
    END;
    after := pg_temp.authz_snapshot(request_id, phone);
    IF NOT rejected OR after <> before THEN
      RAISE EXCEPTION 'wrong Training session was accepted or left rows: before %, after %', before, after;
    END IF;
    PERFORM pg_temp.authz_result('Training wrong session denied atomically', 'PASS', 'Owner session rejected; no partial rows');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.authz_result('Training wrong session denied atomically', 'FAIL', SQLERRM);
  END;
END;
$$;

\echo 'DENY — restricted trainee cannot open a cash session'
DO $$
DECLARE
  trainee_id constant uuid := '00000000-0000-0000-0000-000000000101';
  before_count bigint;
  after_count bigint;
  rejected boolean := false;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', trainee_id::text, true);
    PERFORM set_config('app.finance_training_session_id', '', true);
    before_count := pg_temp.authz_session_count(trainee_id);
    BEGIN
      PERFORM public.open_finance_cash_session(0);
    EXCEPTION WHEN OTHERS THEN
      rejected := true;
    END;
    after_count := pg_temp.authz_session_count(trainee_id);
    IF NOT rejected OR after_count <> before_count THEN
      RAISE EXCEPTION 'Training trainee opened a session or changed session count % -> %', before_count, after_count;
    END IF;
    PERFORM pg_temp.authz_result('Training cannot open own cash session', 'PASS', 'open_finance_cash_session rejected; no session created');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.authz_result('Training cannot open own cash session', 'FAIL', SQLERRM);
  END;
END;
$$;

\echo 'DENY — Housekeeping cannot call combined reservation or settlement'
DO $$
DECLARE
  hk_id constant uuid := '00000000-0000-0000-0000-000000000106';
  room_id uuid := pg_temp.authz_room('11');
  package_id uuid;
  session_id uuid := pg_temp.authz_get('receptionist_session');
  total numeric := pg_temp.authz_price('11', 'Paket 24 Jam');
  first_amount numeric;
  second_amount numeric;
  reservation_request uuid := '31555555-5555-4555-8555-555555555555';
  reservation_phone text := '081911111108';
  before jsonb;
  after jsonb;
  rejected_reservation boolean := false;
  rejected_payment boolean := false;
  owner_tx uuid := pg_temp.authz_get('owner_tx');
  payment_before bigint;
  payment_after bigint;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', hk_id::text, true);
    PERFORM set_config('app.finance_training_session_id', '', true);
    before := pg_temp.authz_snapshot(reservation_request, reservation_phone);
    package_id := pg_temp.authz_package('Paket 24 Jam');
    first_amount := floor(total / 2); second_amount := total - first_amount;
    BEGIN
      PERFORM public.create_reservation_combined(
        'check_in', room_id, package_id, 'Housekeeping Illegal', reservation_phone, 'Auth Test',
        jsonb_build_array(
          jsonb_build_object('method', 'QRIS', 'amount', first_amount, 'idempotency_key', '31655555-5555-4555-8555-555555555551'::uuid),
          jsonb_build_object('method', 'Cash', 'amount', second_amount, 'idempotency_key', '31655555-5555-4555-8555-555555555552'::uuid)
        ), 'weekday', NULL, reservation_request, 'auth-housekeeping-illegal', session_id, 2
      );
    EXCEPTION WHEN OTHERS THEN
      rejected_reservation := true;
    END;
    after := pg_temp.authz_snapshot(reservation_request, reservation_phone);
    IF NOT rejected_reservation OR after <> before THEN
      RAISE EXCEPTION 'Housekeeping reservation accepted or left rows: before %, after %', before, after;
    END IF;

    payment_before := pg_temp.authz_payment_count(owner_tx);
    BEGIN
      PERFORM public.record_transaction_payment_combined(
        owner_tx,
        jsonb_build_array(jsonb_build_object('method', 'Cash', 'amount', 1, 'idempotency_key', '31755555-5555-4555-8555-555555555551'::uuid)),
        '31855555-5555-4555-8555-555555555555'::uuid,
        'auth-housekeeping-payment-illegal',
        session_id
      );
    EXCEPTION WHEN OTHERS THEN
      rejected_payment := true;
    END;
    payment_after := pg_temp.authz_payment_count(owner_tx);
    IF NOT rejected_payment OR payment_after <> payment_before THEN
      RAISE EXCEPTION 'Housekeeping settlement accepted or added a payment: % -> %', payment_before, payment_after;
    END IF;
    PERFORM pg_temp.authz_result('Illegal Housekeeping combined access denied', 'PASS', 'reservation and settlement rejected atomically');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.authz_result('Illegal Housekeeping combined access denied', 'FAIL', SQLERRM);
  END;
END;
$$;

\echo 'DENY — Supervisor cannot assign another supervisor as Training owner'
DO $$
DECLARE
  supervisor_id constant uuid := '00000000-0000-0000-0000-000000000102';
  trainee_id constant uuid := '00000000-0000-0000-0000-000000000106';
  before_count bigint;
  after_count bigint;
  rejected boolean := false;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', supervisor_id::text, true);
    PERFORM set_config('app.finance_training_session_id', '', true);
    SELECT count(*) INTO before_count FROM public.finance_training_assignments WHERE trainee_user_id = trainee_id;
    BEGIN
      PERFORM public.create_finance_training_assignment(
        trainee_id, '11111111-1111-4111-8111-111111111111', (now() AT TIME ZONE 'Asia/Jakarta')::date
      );
    EXCEPTION WHEN OTHERS THEN
      rejected := true;
    END;
    SELECT count(*) INTO after_count FROM public.finance_training_assignments WHERE trainee_user_id = trainee_id;
    IF NOT rejected OR after_count <> before_count THEN
      RAISE EXCEPTION 'Supervisor assigned another supervisor as owner or changed assignment count';
    END IF;
    PERFORM pg_temp.authz_result('Supervisor assignment boundary', 'PASS', 'cannot assign Owner as supervisor on behalf of another user');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.authz_result('Supervisor assignment boundary', 'FAIL', SQLERRM);
  END;
END;
$$;

\echo 'RESULTS'
TABLE authz_results ORDER BY id;
DO $$
DECLARE
  failures integer;
BEGIN
  SELECT count(*) INTO failures FROM authz_results WHERE status = 'FAIL';
  IF failures > 0 THEN
    RAISE EXCEPTION 'Authorization combined-payment runtime tests failed: % failure(s)', failures;
  END IF;
END;
$$;

ROLLBACK;
\echo 'AUTHORIZATION COMBINED PAYMENT RUNTIME TESTS PASS — transaction rolled back; local test data not committed'
