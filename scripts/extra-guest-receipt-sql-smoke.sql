BEGIN;
DO $test$
DECLARE
  v_owner uuid; v_room uuid; v_package uuid; v_day text; v_number text; v_tx public.transactions; v_paid numeric;
  v_session uuid; v_payment uuid; v_receipt uuid; v_one jsonb; v_two jsonb; v_before integer; v_after integer;
BEGIN
  SELECT user_id INTO v_owner FROM public.user_roles WHERE role='owner'::public.app_role ORDER BY user_id LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  INSERT INTO public.finance_cash_sessions(opened_by,opening_cash,status) VALUES(v_owner,0,'OPEN') RETURNING id INTO v_session;
  SELECT r.id, p.id INTO v_room, v_package
  FROM public.rooms r JOIN public.room_types rt ON rt.id=r.room_type_id
  JOIN public.package_room_type_prices pr ON pr.pricing_group=rt.pricing_group
  JOIN public.packages p ON p.id=pr.package_id AND p.active
  WHERE r.active AND r.status='ready'
    AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.room_id=r.id AND t.status='booking') LIMIT 1;
  v_day := public.get_operational_day_mode((now() AT TIME ZONE 'Asia/Jakarta')::date + 1);
  v_number := public.create_reservation('booking',v_room,v_package,'Extra Guest Test','081199999991','Local test',48000,'Cash',v_day,((now() AT TIME ZONE 'Asia/Jakarta')::date + 1 + time '10:00') AT TIME ZONE 'Asia/Jakarta',gen_random_uuid(),v_session,3);
  SELECT * INTO v_tx FROM public.transactions WHERE transaction_number=v_number;
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.payments WHERE transaction_id=v_tx.id;
  IF v_tx.guest_count<>3 OR v_tx.extra_guest_count<>1 OR v_tx.extra_guest_charge<>50000 OR v_tx.price_snapshot <= v_tx.base_price_snapshot OR v_paid<>48000 THEN RAISE EXCEPTION 'Extra Guest snapshot mismatch'; END IF;
  SELECT count(*) INTO v_before FROM public.payments;
  SELECT id INTO v_payment FROM public.payments ORDER BY created_at, id LIMIT 1;
  v_receipt := public.issue_payment_receipt(v_payment);
  v_one := public.request_receipt_print(v_receipt,gen_random_uuid());
  v_two := public.request_receipt_print(v_receipt,gen_random_uuid());
  IF v_receipt IS NULL OR (v_one->>'print_no')::integer<>1 OR (v_one->>'copy_label')<>'' OR (v_two->>'print_no')::integer<>2 OR (v_two->>'copy_label')<>'SALINAN 1' THEN RAISE EXCEPTION 'Receipt copy sequence mismatch'; END IF;
  SELECT count(*) INTO v_after FROM public.payments;
  IF v_before<>v_after THEN RAISE EXCEPTION 'Receipt changed payment rows'; END IF;
  RAISE NOTICE 'EXTRA_GUEST_RECEIPT_SQL_SMOKE_PASS';
END
$test$;
ROLLBACK;
