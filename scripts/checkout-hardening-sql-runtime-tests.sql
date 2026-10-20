\set ON_ERROR_STOP on
\echo ==== CHECKOUT HARDENING RUNTIME TESTS ====
SET timezone = 'Asia/Jakarta';
RESET ROLE;
RESET request.jwt.claim.sub;

-- Fixed local-only identities.
INSERT INTO auth.users (id) VALUES
  ('44444444-4444-4444-8444-444444444444'),
  ('55555555-5555-4555-8555-555555555555'),
  ('66666666-6666-4666-8666-666666666666'),
  ('77777777-7777-4777-8777-777777777777')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('44444444-4444-4444-8444-444444444444', 'employee'),
  ('55555555-5555-4555-8555-555555555555', 'employee'),
  ('66666666-6666-4666-8666-666666666666', 'employee'),
  ('77777777-7777-4777-8777-777777777777', 'employee')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.employees (user_id, name, employee_id, position, active) VALUES
  ('44444444-4444-4444-8444-444444444444', 'Checkout Receptionist', 'TEST-CO-REC', 'receptionist', true),
  ('55555555-5555-4555-8555-555555555555', 'Checkout Housekeeping', 'TEST-CO-HK', 'housekeeping', true),
  ('66666666-6666-4666-8666-666666666666', 'Checkout Trainee', 'TEST-CO-TRAIN', 'receptionist', true),
  ('77777777-7777-4777-8777-777777777777', 'Checkout Supervisor', 'TEST-CO-SUP', 'supervisor', true)
ON CONFLICT (user_id) DO UPDATE
SET position = EXCLUDED.position, active = EXCLUDED.active;

INSERT INTO public.finance_cash_sessions (opened_by, operational_date, opening_cash, status)
VALUES
  ('44444444-4444-4444-8444-444444444444', CURRENT_DATE, 0, 'OPEN'),
  ('77777777-7777-4777-8777-777777777777', CURRENT_DATE, 0, 'OPEN')
ON CONFLICT DO NOTHING;

INSERT INTO public.finance_training_assignments (
  trainee_user_id, supervisor_user_id, starts_on, ends_on, status, created_by
)
VALUES (
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777',
  CURRENT_DATE,
  CURRENT_DATE + 1,
  'ACTIVE',
  '11111111-1111-4111-8111-111111111111'
)
ON CONFLICT DO NOTHING;

SELECT id AS rec_session_id
FROM public.finance_cash_sessions
WHERE opened_by = '44444444-4444-4444-8444-444444444444' AND status = 'OPEN'
ORDER BY opened_at DESC LIMIT 1 \gset
SELECT id AS training_session_id
FROM public.finance_cash_sessions
WHERE opened_by = '77777777-7777-4777-8777-777777777777' AND status = 'OPEN'
ORDER BY opened_at DESC LIMIT 1 \gset
SELECT id AS test_package_id FROM public.packages WHERE active ORDER BY name LIMIT 1 \gset
SELECT id AS room_a FROM public.rooms WHERE active AND status = 'ready' ORDER BY room_number LIMIT 1 \gset
SELECT id AS room_b FROM public.rooms WHERE active AND status = 'ready' ORDER BY room_number OFFSET 1 LIMIT 1 \gset
SELECT id AS room_c FROM public.rooms WHERE active AND status = 'ready' ORDER BY room_number OFFSET 2 LIMIT 1 \gset
SELECT id AS room_d FROM public.rooms WHERE active AND status = 'ready' ORDER BY room_number OFFSET 3 LIMIT 1 \gset
SELECT id AS room_e FROM public.rooms WHERE active AND status = 'ready' ORDER BY room_number OFFSET 4 LIMIT 1 \gset
SELECT id AS room_f FROM public.rooms WHERE active AND status = 'ready' ORDER BY room_number OFFSET 5 LIMIT 1 \gset
SELECT id AS room_g FROM public.rooms WHERE active AND status = 'ready' ORDER BY room_number OFFSET 6 LIMIT 1 \gset
SELECT id AS room_h FROM public.rooms WHERE active AND status = 'ready' ORDER BY room_number OFFSET 7 LIMIT 1 \gset

INSERT INTO public.guests (id, full_name, address, phone) VALUES
  ('00000000-0000-0000-0000-000000003001', 'Checkout Paid', 'Local', '081234560001'),
  ('00000000-0000-0000-0000-000000003002', 'Checkout Unpaid', 'Local', '081234560002'),
  ('00000000-0000-0000-0000-000000003003', 'Checkout DP', 'Local', '081234560003'),
  ('00000000-0000-0000-0000-000000003004', 'Checkout Combined', 'Local', '081234560004'),
  ('00000000-0000-0000-0000-000000003005', 'Checkout Invalid', 'Local', '081234560005'),
  ('00000000-0000-0000-0000-000000003006', 'Checkout Unauthorized', 'Local', '081234560006'),
  ('00000000-0000-0000-0000-000000003007', 'Checkout Concurrent', 'Local', '081234560007'),
  ('00000000-0000-0000-0000-000000003008', 'Checkout Training', 'Local', '081234560008')
ON CONFLICT (id) DO NOTHING;

-- Direct setup is performed as the local superuser. All checkout assertions
-- below run through authenticated RPC paths.
UPDATE public.rooms SET status = 'occupied' WHERE id IN (:'room_a', :'room_b', :'room_c', :'room_d', :'room_e', :'room_f', :'room_g', :'room_h');

INSERT INTO public.transactions (
  id, transaction_number, guest_id, room_id, package_id, status, created_by,
  price_snapshot, started_at, ends_at
)
VALUES
  ('00000000-0000-0000-0000-000000003101', 'BTRD25-003101', '00000000-0000-0000-0000-000000003001', :'room_a', :'test_package_id', 'check_in', '11111111-1111-4111-8111-111111111111', 1000, now(), now() + interval '1 hour'),
  ('00000000-0000-0000-0000-000000003102', 'BTRD25-003102', '00000000-0000-0000-0000-000000003002', :'room_b', :'test_package_id', 'check_in', '11111111-1111-4111-8111-111111111111', 1000, now(), now() + interval '1 hour'),
  ('00000000-0000-0000-0000-000000003103', 'BTRD25-003103', '00000000-0000-0000-0000-000000003003', :'room_c', :'test_package_id', 'check_in', '11111111-1111-4111-8111-111111111111', 1000, now(), now() + interval '1 hour'),
  ('00000000-0000-0000-0000-000000003104', 'BTRD25-003104', '00000000-0000-0000-0000-000000003004', :'room_d', :'test_package_id', 'check_in', '11111111-1111-4111-8111-111111111111', 1000, now(), now() + interval '1 hour'),
  ('00000000-0000-0000-0000-000000003105', 'BTRD25-003105', '00000000-0000-0000-0000-000000003005', :'room_e', :'test_package_id', 'check_in', '11111111-1111-4111-8111-111111111111', 1000, now(), now() + interval '1 hour'),
  ('00000000-0000-0000-0000-000000003106', 'BTRD25-003106', '00000000-0000-0000-0000-000000003006', :'room_f', :'test_package_id', 'check_in', '11111111-1111-4111-8111-111111111111', 1000, now(), now() + interval '1 hour'),
  ('00000000-0000-0000-0000-000000003107', 'BTRD25-003107', '00000000-0000-0000-0000-000000003007', :'room_g', :'test_package_id', 'check_in', '11111111-1111-4111-8111-111111111111', 1000, now(), now() + interval '1 hour'),
  ('00000000-0000-0000-0000-000000003108', 'BTRD25-003108', '00000000-0000-0000-0000-000000003008', :'room_h', :'test_package_id', 'check_in', '11111111-1111-4111-8111-111111111111', 1000, now(), now() + interval '1 hour')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payments (
  id, transaction_id, amount, method, kind, recorded_by, idempotency_key, cash_session_id
)
VALUES
  ('00000000-0000-0000-0000-000000003201', '00000000-0000-0000-0000-000000003101', 1000, 'Cash', 'payment', '44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000003301', :'rec_session_id'),
  ('00000000-0000-0000-0000-000000003202', '00000000-0000-0000-0000-000000003103', 400, 'Cash', 'dp', '44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000003302', :'rec_session_id'),
  ('00000000-0000-0000-0000-000000003203', '00000000-0000-0000-0000-000000003104', 400, 'QRIS', 'dp', '44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000003303', :'rec_session_id'),
  ('00000000-0000-0000-0000-000000003204', '00000000-0000-0000-0000-000000003104', 600, 'Transfer', 'payment', '44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000003304', :'rec_session_id'),
  ('00000000-0000-0000-0000-000000003205', '00000000-0000-0000-0000-000000003106', 1000, 'Cash', 'payment', '44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000003305', :'rec_session_id'),
  ('00000000-0000-0000-0000-000000003206', '00000000-0000-0000-0000-000000003107', 1000, 'Cash', 'payment', '44444444-4444-4444-8444-444444444444', '00000000-0000-0000-0000-000000003306', :'rec_session_id'),
  ('00000000-0000-0000-0000-000000003207', '00000000-0000-0000-0000-000000003108', 1000, 'Transfer', 'payment', '77777777-7777-4777-8777-777777777777', '00000000-0000-0000-0000-000000003307', :'training_session_id')
ON CONFLICT (id) DO NOTHING;

\echo '1 paid checkout succeeds'
SET ROLE authenticated;
SET request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
SELECT public.check_out_transaction('00000000-0000-0000-0000-000000003101');
RESET ROLE;
RESET request.jwt.claim.sub;

\echo '2 unpaid checkout rejected'
SET ROLE authenticated;
SET request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
DO $$ BEGIN
  BEGIN
    PERFORM public.check_out_transaction('00000000-0000-0000-0000-000000003102');
    RAISE EXCEPTION 'unexpected unpaid checkout success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Check-out ditolak: sisa settlement masih %' THEN RAISE NOTICE 'PASS unpaid-rejected'; ELSE RAISE; END IF;
  END;
END $$;
RESET ROLE;
RESET request.jwt.claim.sub;

\echo '3 DP-only checkout rejected'
SET ROLE authenticated;
SET request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
DO $$ BEGIN
  BEGIN
    PERFORM public.check_out_transaction('00000000-0000-0000-0000-000000003103');
    RAISE EXCEPTION 'unexpected DP checkout success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Check-out ditolak: sisa settlement masih %' THEN RAISE NOTICE 'PASS dp-rejected'; ELSE RAISE; END IF;
  END;
END $$;
RESET ROLE;
RESET request.jwt.claim.sub;

\echo '4 combined payment checkout succeeds'
SET ROLE authenticated;
SET request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
SELECT public.check_out_transaction('00000000-0000-0000-0000-000000003104');
RESET ROLE;
RESET request.jwt.claim.sub;

\echo '5 unrelated/unrecorded payment does not settle transaction'
SET ROLE authenticated;
SET request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
DO $$ BEGIN
  BEGIN
    PERFORM public.check_out_transaction('00000000-0000-0000-0000-000000003105');
    RAISE EXCEPTION 'unexpected unrelated payment success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Check-out ditolak: sisa settlement masih %' THEN RAISE NOTICE 'PASS unrelated-payment-rejected'; ELSE RAISE; END IF;
  END;
END $$;
RESET ROLE;
RESET request.jwt.claim.sub;

\echo '6 duplicate checkout rejected'
SET ROLE authenticated;
SET request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
DO $$ BEGIN
  BEGIN
    PERFORM public.check_out_transaction('00000000-0000-0000-0000-000000003101');
    RAISE EXCEPTION 'unexpected duplicate checkout success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Hanya transaksi CHECK-IN%' THEN RAISE NOTICE 'PASS duplicate-rejected'; ELSE RAISE; END IF;
  END;
END $$;
RESET ROLE;
RESET request.jwt.claim.sub;

\echo '7 unauthorized operator rejected'
SET ROLE authenticated;
SET request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';
DO $$ BEGIN
  BEGIN
    PERFORM public.check_out_transaction('00000000-0000-0000-0000-000000003106');
    RAISE EXCEPTION 'unexpected unauthorized checkout success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Akses ditolak' THEN RAISE NOTICE 'PASS unauthorized-rejected'; ELSE RAISE; END IF;
  END;
END $$;
RESET ROLE;
RESET request.jwt.claim.sub;

\echo '8 payment mutation after checkout rejected by state guard'
DO $$ BEGIN
  BEGIN
    INSERT INTO public.payments (transaction_id, amount, method, kind, recorded_by)
    VALUES ('00000000-0000-0000-0000-000000003101', 1, 'Cash', 'payment', '44444444-4444-4444-8444-444444444444');
    RAISE EXCEPTION 'unexpected post-checkout payment success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Pembayaran tidak dapat diubah setelah transaksi ditutup%' THEN
      RAISE NOTICE 'PASS post-checkout-payment-rejected';
    ELSE
      RAISE;
    END IF;
  END;
END $$;

\echo '9 Extend/Overtime charge is an additional settlement obligation'
INSERT INTO public.finance_charge_events (
  id, idempotency_key, transaction_id, kind, amount, processed_by,
  commission_mode, commission_rate, commission_per_room_amount,
  commission_rounding
)
VALUES (
  '00000000-0000-0000-0000-000000003401',
  '00000000-0000-0000-0000-000000003402',
  '00000000-0000-0000-0000-000000003106',
  'overtime', 250, '44444444-4444-4444-8444-444444444444',
  'OFF', 0, 0, 'FLOOR_RP1000'
);
INSERT INTO public.payments (
  id, transaction_id, amount, method, kind, recorded_by,
  idempotency_key, cash_session_id, charge_event_id
)
VALUES (
  '00000000-0000-0000-0000-000000003208',
  '00000000-0000-0000-0000-000000003106',
  250, 'Cash', 'payment', '44444444-4444-4444-8444-444444444444',
  '00000000-0000-0000-0000-000000003408', :'rec_session_id',
  '00000000-0000-0000-0000-000000003401'
);
SET ROLE authenticated;
SET request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
SELECT public.check_out_transaction('00000000-0000-0000-0000-000000003106');
RESET ROLE;
RESET request.jwt.claim.sub;

\echo '9a settlement records cannot move between transactions'
INSERT INTO public.finance_charge_events (
  id, idempotency_key, transaction_id, kind, amount, processed_by,
  commission_mode, commission_rate, commission_per_room_amount,
  commission_rounding
)
VALUES (
  '00000000-0000-0000-0000-000000003411',
  '00000000-0000-0000-0000-000000003412',
  '00000000-0000-0000-0000-000000003102',
  'extend', 10, '44444444-4444-4444-8444-444444444444',
  'OFF', 0, 0, 'FLOOR_RP1000'
);
DO $$ BEGIN
  BEGIN
    UPDATE public.finance_charge_events
    SET transaction_id = '00000000-0000-0000-0000-000000003103'
    WHERE id = '00000000-0000-0000-0000-000000003411';
    RAISE EXCEPTION 'unexpected charge relocation success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Settlement tidak dapat dipindahkan ke transaksi lain' THEN
      RAISE NOTICE 'PASS charge-relocation-rejected';
    ELSE
      RAISE;
    END IF;
  END;
END $$;

INSERT INTO public.payments (
  id, transaction_id, amount, method, kind, recorded_by,
  idempotency_key, cash_session_id
)
VALUES (
  '00000000-0000-0000-0000-000000003212',
  '00000000-0000-0000-0000-000000003102',
  10, 'Cash', 'payment', '44444444-4444-4444-8444-444444444444',
  '00000000-0000-0000-0000-000000003413', :'rec_session_id'
);
SET ROLE authenticated;
SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
SELECT public.create_finance_refund(
  '00000000-0000-0000-0000-000000003414',
  '00000000-0000-0000-0000-000000003102',
  1, 'CASH', 'OWNER_FUNDS', NULL, 'Runtime relocation guard test'
) AS relocation_refund_id \gset
RESET ROLE;
RESET request.jwt.claim.sub;
DO $$ BEGIN
  BEGIN
    UPDATE public.finance_refunds
    SET transaction_id = '00000000-0000-0000-0000-000000003103'
    WHERE id = (
      SELECT id
      FROM public.finance_refunds
      WHERE idempotency_key = '00000000-0000-0000-0000-000000003414'
    );
    RAISE EXCEPTION 'unexpected refund relocation success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Settlement tidak dapat dipindahkan ke transaksi lain' THEN
      RAISE NOTICE 'PASS refund-relocation-rejected';
    ELSE
      RAISE;
    END IF;
  END;
END $$;

\echo '10 Refund reduces net settlement and requires replacement payment'
INSERT INTO public.payments (
  id, transaction_id, amount, method, kind, recorded_by,
  idempotency_key, cash_session_id
)
VALUES (
  '00000000-0000-0000-0000-000000003209',
  '00000000-0000-0000-0000-000000003105',
  1000, 'Cash', 'payment', '44444444-4444-4444-8444-444444444444',
  '00000000-0000-0000-0000-000000003409', :'rec_session_id'
);
SET ROLE authenticated;
SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
SELECT public.create_finance_refund(
  '00000000-0000-0000-0000-000000003410',
  '00000000-0000-0000-0000-000000003105',
  200, 'CASH', 'OWNER_FUNDS', NULL, 'Runtime refund settlement test'
);
RESET ROLE;
RESET request.jwt.claim.sub;
SET ROLE authenticated;
SET request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
DO $$ BEGIN
  BEGIN
    PERFORM public.check_out_transaction('00000000-0000-0000-0000-000000003105');
    RAISE EXCEPTION 'unexpected refund settlement success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Check-out ditolak: sisa settlement masih %' THEN RAISE NOTICE 'PASS refund-underpaid-rejected'; ELSE RAISE; END IF;
  END;
END $$;
RESET ROLE;
RESET request.jwt.claim.sub;
INSERT INTO public.payments (
  id, transaction_id, amount, method, kind, recorded_by,
  idempotency_key, cash_session_id
)
VALUES (
  '00000000-0000-0000-0000-000000003211',
  '00000000-0000-0000-0000-000000003105',
  200, 'QRIS', 'payment', '44444444-4444-4444-8444-444444444444',
  '00000000-0000-0000-0000-000000003412', :'rec_session_id'
);
SET ROLE authenticated;
SET request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
SELECT public.check_out_transaction('00000000-0000-0000-0000-000000003105');
RESET ROLE;
RESET request.jwt.claim.sub;

\echo '11 Housekeeping transition and single audit row'
DO $$
DECLARE
  tx_status text;
  room_status text;
  audit_count integer;
BEGIN
  SELECT status::text INTO tx_status FROM public.transactions WHERE id = '00000000-0000-0000-0000-000000003101';
  SELECT r.status::text INTO room_status FROM public.rooms r JOIN public.transactions t ON t.room_id = r.id WHERE t.id = '00000000-0000-0000-0000-000000003101';
  SELECT count(*) INTO audit_count FROM public.activity_logs WHERE action = 'check_out' AND entity_id = '00000000-0000-0000-0000-000000003101';
  IF tx_status <> 'check_out' OR room_status <> 'dirty' OR audit_count <> 1 THEN
    RAISE EXCEPTION 'FAIL transition/audit: tx %, room %, audit %', tx_status, room_status, audit_count;
  END IF;
  RAISE NOTICE 'PASS transition-housekeeping-audit';
END $$;

\echo '12 Training wrapper remains enforced'
SET ROLE authenticated;
SET request.jwt.claim.sub = '66666666-6666-4666-8666-666666666666';
SELECT public.check_out_training_transaction('00000000-0000-0000-0000-000000003108', :'training_session_id');
RESET ROLE;
RESET request.jwt.claim.sub;

DO $$
DECLARE
  tx_status text;
  room_status text;
  audit_count integer;
BEGIN
  SELECT status::text INTO tx_status FROM public.transactions WHERE id = '00000000-0000-0000-0000-000000003108';
  SELECT r.status::text INTO room_status FROM public.rooms r JOIN public.transactions t ON t.room_id = r.id WHERE t.id = '00000000-0000-0000-0000-000000003108';
  SELECT count(*) INTO audit_count FROM public.finance_training_audit WHERE transaction_id = '00000000-0000-0000-0000-000000003108' AND label = 'Training';
  IF tx_status <> 'check_out' OR room_status <> 'dirty' OR audit_count < 1 THEN
    RAISE EXCEPTION 'FAIL Training checkout: tx %, room %, audit %', tx_status, room_status, audit_count;
  END IF;
  RAISE NOTICE 'PASS training-checkout-enforced';
END $$;

\echo 'invalid payment constraint rejected'
DO $$ BEGIN
  BEGIN
    INSERT INTO public.payments (transaction_id, amount, method, kind, recorded_by)
    VALUES ('00000000-0000-0000-0000-000000003102', -1, 'Cash', 'payment', '44444444-4444-4444-8444-444444444444');
    RAISE EXCEPTION 'unexpected invalid payment success';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS invalid-payment-rejected';
  END;
END $$;

SELECT 'CHECKOUT_HARDENING_RUNTIME_PASS' AS result;
