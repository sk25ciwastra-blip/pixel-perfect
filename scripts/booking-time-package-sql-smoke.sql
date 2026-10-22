BEGIN;
DO $test$
DECLARE
  v_owner uuid;
  v_package record;
  v_room uuid;
  v_guest uuid;
  v_session uuid;
  v_tx uuid;
  v_now timestamptz := now();
  v_ends timestamptz;
  v_expected interval;
  v_i integer := 0;
  v_pagi uuid;
  v_malam uuid;
  v_harian uuid;
  v_special_end timestamptz;
BEGIN
  SELECT user_id INTO v_owner FROM public.user_roles WHERE role = 'owner'::public.app_role ORDER BY user_id LIMIT 1;
  SELECT id INTO v_session FROM public.finance_cash_sessions WHERE opened_by = v_owner AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;
  IF v_session IS NULL THEN INSERT INTO public.finance_cash_sessions(opened_by,opening_cash,status) VALUES(v_owner,0,'OPEN') RETURNING id INTO v_session; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);

  FOR v_package IN
    SELECT id, name, duration_minutes FROM public.packages
    WHERE name IN ('Paket 2 Jam','Paket 4 Jam','Paket 6 Jam','Paket 12 Jam','Paket 24 Jam') AND active
    ORDER BY duration_minutes
  LOOP
    v_i := v_i + 1;
    SELECT id INTO v_room FROM public.rooms WHERE active AND status = 'ready' ORDER BY room_number LIMIT 1 FOR UPDATE;
    INSERT INTO public.guests(full_name,address,phone) VALUES ('Duration Package Test ' || v_i, 'Local Test', '081199991' || lpad(v_i::text,3,'0')) RETURNING id INTO v_guest;
    INSERT INTO public.transactions(guest_id,room_id,package_id,status,created_by,price_snapshot,day_mode,scheduled_check_in,scheduled_check_out)
      VALUES(v_guest,v_room,v_package.id,'booking',v_owner,1000,'weekday',v_now + interval '10 minutes',v_now + (v_package.duration_minutes + 10) * interval '1 minute') RETURNING id INTO v_tx;
    INSERT INTO public.payments(transaction_id,amount,method,kind,recorded_by,cash_session_id) VALUES(v_tx,1000,'Cash','dp',v_owner,v_session);
    PERFORM public.check_in_booking(v_tx);
    SELECT ends_at INTO v_ends FROM public.transactions WHERE id = v_tx;
    v_expected := v_package.duration_minutes * interval '1 minute';
    IF abs(extract(epoch FROM (v_ends - (v_now + v_expected)))) > 2 THEN RAISE EXCEPTION 'FAIL duration package %', v_package.name; END IF;
    RAISE NOTICE 'PASS duration %', v_package.name;
  END LOOP;

  SELECT id INTO v_pagi FROM public.packages WHERE name = 'Paket Pagi' AND active LIMIT 1;
  SELECT id INTO v_malam FROM public.packages WHERE name = 'Paket Malam' AND active LIMIT 1;
  SELECT id INTO v_harian FROM public.packages WHERE name = 'Paket Harian' AND active LIMIT 1;
  SELECT t.ends_at INTO v_special_end FROM public.calculate_package_stay_times(v_pagi, '2026-10-22 09:00:00+07'::timestamptz) t;
  IF v_special_end <> '2026-10-22 16:00:00+07'::timestamptz THEN RAISE EXCEPTION 'FAIL Paket Pagi timing'; END IF;
  SELECT t.ends_at INTO v_special_end FROM public.calculate_package_stay_times(v_malam, '2026-10-22 22:30:00+07'::timestamptz) t;
  IF v_special_end <> '2026-10-23 08:00:00+07'::timestamptz THEN RAISE EXCEPTION 'FAIL Paket Malam timing'; END IF;
  SELECT t.ends_at INTO v_special_end FROM public.calculate_package_stay_times(v_harian, '2026-10-22 13:00:00+07'::timestamptz) t;
  IF v_special_end <> '2026-10-23 12:00:00+07'::timestamptz THEN RAISE EXCEPTION 'FAIL Paket Harian timing'; END IF;
  RAISE NOTICE 'PASS special package timing';
END
$test$;
ROLLBACK;
