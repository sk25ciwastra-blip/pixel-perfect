BEGIN;

DO $test$
DECLARE
  v_owner uuid;
  v_package uuid;
  v_room uuid;
  v_guest uuid;
  v_session uuid;
  v_tx uuid;
  v_number text;
  v_now timestamptz := now();
  v_ends timestamptz;
  v_status public.transaction_status;
  v_room_status public.room_status;
  v_expired_rejected boolean := false;
BEGIN
  SELECT user_id INTO v_owner FROM public.user_roles WHERE role = 'owner'::public.app_role ORDER BY user_id LIMIT 1;
  SELECT id INTO v_package FROM public.packages WHERE name = 'Paket 2 Jam' AND active LIMIT 1;
  IF v_owner IS NULL OR v_package IS NULL THEN RAISE EXCEPTION 'P2 fixture dependencies missing'; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  SELECT id INTO v_session FROM public.finance_cash_sessions WHERE opened_by = v_owner AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;
  IF v_session IS NULL THEN
    INSERT INTO public.finance_cash_sessions(opened_by, opening_cash, status) VALUES (v_owner, 0, 'OPEN') RETURNING id INTO v_session;
  END IF;

  -- Early: now < scheduled start, so duration is measured from actual start.
  SELECT id INTO v_room FROM public.rooms WHERE active AND status = 'ready' ORDER BY room_number LIMIT 1 FOR UPDATE;
  INSERT INTO public.guests(full_name,address,phone) VALUES ('Early Booking Test','Local Test','081199990001') RETURNING id INTO v_guest;
  INSERT INTO public.transactions(guest_id,room_id,package_id,status,created_by,price_snapshot,day_mode,scheduled_check_in,scheduled_check_out)
    VALUES(v_guest,v_room,v_package,'booking',v_owner,1000,'weekday',v_now + interval '10 minutes',v_now + interval '130 minutes') RETURNING id INTO v_tx;
  INSERT INTO public.payments(transaction_id,amount,method,kind,recorded_by,cash_session_id) VALUES(v_tx,1000,'Cash','dp',v_owner,v_session);
  v_number := public.check_in_booking(v_tx);
  SELECT status, ends_at INTO v_status, v_ends FROM public.transactions WHERE id = v_tx;
  SELECT status INTO v_room_status FROM public.rooms WHERE id = v_room;
  IF v_status <> 'check_in' OR v_room_status <> 'occupied' OR abs(extract(epoch FROM (v_ends - (v_now + interval '120 minutes')))) > 2 THEN
    RAISE EXCEPTION 'FAIL early check-in';
  END IF;
  RAISE NOTICE 'PASS early P2: %', v_number;

  -- On-time: same transaction timestamp makes server_now = scheduled start.
  SELECT id INTO v_room FROM public.rooms WHERE active AND status = 'ready' ORDER BY room_number LIMIT 1 FOR UPDATE;
  INSERT INTO public.guests(full_name,address,phone) VALUES ('On Time Booking Test','Local Test','081199990002') RETURNING id INTO v_guest;
  INSERT INTO public.transactions(guest_id,room_id,package_id,status,created_by,price_snapshot,day_mode,scheduled_check_in,scheduled_check_out)
    VALUES(v_guest,v_room,v_package,'booking',v_owner,1000,'weekday',v_now,v_now + interval '120 minutes') RETURNING id INTO v_tx;
  INSERT INTO public.payments(transaction_id,amount,method,kind,recorded_by,cash_session_id) VALUES(v_tx,1000,'Cash','dp',v_owner,v_session);
  PERFORM public.check_in_booking(v_tx);
  SELECT status, ends_at INTO v_status, v_ends FROM public.transactions WHERE id = v_tx;
  IF v_status <> 'check_in' OR abs(extract(epoch FROM (v_ends - (v_now + interval '120 minutes')))) > 2 THEN RAISE EXCEPTION 'FAIL on-time check-in'; END IF;
  RAISE NOTICE 'PASS on-time P2';

  -- Late: scheduled checkout remains authoritative.
  SELECT id INTO v_room FROM public.rooms WHERE active AND status = 'ready' ORDER BY room_number LIMIT 1 FOR UPDATE;
  INSERT INTO public.guests(full_name,address,phone) VALUES ('Late Booking Test','Local Test','081199990003') RETURNING id INTO v_guest;
  INSERT INTO public.transactions(guest_id,room_id,package_id,status,created_by,price_snapshot,day_mode,scheduled_check_in,scheduled_check_out)
    VALUES(v_guest,v_room,v_package,'booking',v_owner,1000,'weekday',v_now - interval '30 minutes',v_now + interval '90 minutes') RETURNING id INTO v_tx;
  INSERT INTO public.payments(transaction_id,amount,method,kind,recorded_by,cash_session_id) VALUES(v_tx,1000,'Cash','dp',v_owner,v_session);
  PERFORM public.check_in_booking(v_tx);
  SELECT status, ends_at INTO v_status, v_ends FROM public.transactions WHERE id = v_tx;
  IF v_status <> 'check_in' OR abs(extract(epoch FROM (v_ends - (v_now + interval '90 minutes')))) > 2 THEN RAISE EXCEPTION 'FAIL late check-in'; END IF;
  RAISE NOTICE 'PASS late P2';

  -- Expired: the RPC must fail before room or transaction mutation.
  SELECT id INTO v_room FROM public.rooms WHERE active AND status = 'ready' ORDER BY room_number LIMIT 1 FOR UPDATE;
  INSERT INTO public.guests(full_name,address,phone) VALUES ('Expired Booking Test','Local Test','081199990004') RETURNING id INTO v_guest;
  INSERT INTO public.transactions(guest_id,room_id,package_id,status,created_by,price_snapshot,day_mode,scheduled_check_in,scheduled_check_out)
    VALUES(v_guest,v_room,v_package,'booking',v_owner,1000,'weekday',v_now - interval '130 minutes',v_now) RETURNING id INTO v_tx;
  INSERT INTO public.payments(transaction_id,amount,method,kind,recorded_by,cash_session_id) VALUES(v_tx,1000,'Cash','dp',v_owner,v_session);
  BEGIN
    PERFORM public.check_in_booking(v_tx);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Booking sudah kedaluwarsa%' THEN v_expired_rejected := true; ELSE RAISE; END IF;
  END;
  SELECT status INTO v_status FROM public.transactions WHERE id = v_tx;
  SELECT status INTO v_room_status FROM public.rooms WHERE id = v_room;
  IF NOT v_expired_rejected OR v_status <> 'booking' OR v_room_status <> 'ready' THEN RAISE EXCEPTION 'FAIL expired check-in'; END IF;
  RAISE NOTICE 'PASS expired boundary';

  RAISE NOTICE 'BOOKING_TIME_SQL_SMOKE_PASS';
END
$test$;

ROLLBACK;
