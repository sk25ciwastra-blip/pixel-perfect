BEGIN;
DO $seed$
DECLARE
  v_owner uuid;
  v_package uuid;
  v_room uuid;
  v_guest uuid;
  v_session uuid;
  v_tx uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.user_roles WHERE role='owner'::public.app_role ORDER BY user_id LIMIT 1;
  SELECT id INTO v_package FROM public.packages WHERE name='Paket 2 Jam' AND active LIMIT 1;
  SELECT id INTO v_room FROM public.rooms WHERE active AND status='ready' ORDER BY room_number LIMIT 1 FOR UPDATE;
  SELECT id INTO v_session FROM public.finance_cash_sessions WHERE opened_by=v_owner AND status='OPEN' ORDER BY opened_at DESC LIMIT 1;
  IF v_session IS NULL THEN INSERT INTO public.finance_cash_sessions(opened_by,opening_cash,status) VALUES(v_owner,0,'OPEN') RETURNING id INTO v_session; END IF;
  PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
  INSERT INTO public.guests(full_name,address,phone) VALUES('Concurrency Booking Test','Local Test','081199991010') RETURNING id INTO v_guest;
  INSERT INTO public.transactions(guest_id,room_id,package_id,status,created_by,price_snapshot,day_mode,scheduled_check_in,scheduled_check_out)
    VALUES(v_guest,v_room,v_package,'booking',v_owner,1000,'weekday',now(),now()+interval '120 minutes') RETURNING id INTO v_tx;
  INSERT INTO public.payments(transaction_id,amount,method,kind,recorded_by,cash_session_id) VALUES(v_tx,1000,'Cash','dp',v_owner,v_session);
  RAISE NOTICE 'CONCURRENCY_TX=%',v_tx;
END
$seed$;
COMMIT;
