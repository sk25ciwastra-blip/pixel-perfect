-- Follow-up negative tests against the same isolated local cluster.
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';

DO $$
BEGIN
  BEGIN
    PERFORM public.check_in_booking('00000000-0000-0000-0000-000000009906');
    RAISE EXCEPTION 'unexpected legacy check-in success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Akses ditolak%' OR SQLERRM LIKE 'Peserta Training%' THEN
      RAISE NOTICE 'PASS legacy-checkin-denied';
    ELSE
      RAISE;
    END IF;
  END;

  BEGIN
    PERFORM public.create_reservation(
      'booking',
      '00000000-0000-0000-0000-000000009907',
      '00000000-0000-0000-0000-000000009908',
      'Training Bypass', '081234567891', 'Local Test', 0, 'Cash', 'weekday',
      now(), '00000000-0000-0000-0000-000000009909', NULL
    );
    RAISE EXCEPTION 'unexpected legacy reservation success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Akses ditolak%' OR SQLERRM LIKE 'Peserta Training%' THEN
      RAISE NOTICE 'PASS legacy-reservation-denied';
    ELSE
      RAISE;
    END IF;
  END;

  BEGIN
    PERFORM public.close_finance_cash_session(
      (SELECT id FROM public.finance_cash_sessions
       WHERE opened_by = auth.uid() AND status = 'OPEN'
       ORDER BY opened_at DESC LIMIT 1),
      '{}'::jsonb,
      'Training negative test'
    );
    RAISE EXCEPTION 'unexpected legacy close success';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Peserta Training tidak boleh membuka, mengubah, atau menutup sesi kas%'
       OR SQLERRM LIKE 'Sesi kas tidak aktif%' THEN
      RAISE NOTICE 'PASS legacy-close-own-session-denied';
    ELSE
      RAISE;
    END IF;
  END;
END;
$$;

RESET ROLE;
RESET request.jwt.claim.sub;
