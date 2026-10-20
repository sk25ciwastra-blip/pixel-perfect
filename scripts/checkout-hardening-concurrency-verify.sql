\set ON_ERROR_STOP on
DO $$
DECLARE
  tx_status text;
  room_status text;
  audit_count integer;
BEGIN
  SELECT status::text INTO tx_status
  FROM public.transactions
  WHERE id = '00000000-0000-0000-0000-000000003107';
  SELECT r.status::text INTO room_status
  FROM public.rooms r
  JOIN public.transactions t ON t.room_id = r.id
  WHERE t.id = '00000000-0000-0000-0000-000000003107';
  SELECT count(*) INTO audit_count
  FROM public.activity_logs
  WHERE action = 'check_out'
    AND entity_id = '00000000-0000-0000-0000-000000003107';

  IF tx_status <> 'check_out' OR room_status <> 'dirty' OR audit_count <> 1 THEN
    RAISE EXCEPTION
      'FAIL concurrent checkout: tx %, room %, audit %',
      tx_status, room_status, audit_count;
  END IF;

  RAISE NOTICE 'PASS concurrent-single-transition';
END;
$$;
