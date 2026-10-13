-- Canonical transaction flow: booking stays the same transaction through check-in.
CREATE OR REPLACE FUNCTION public.check_in_booking(_transaction_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_duration integer;
  selected_transaction record;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'owner') OR public.is_receptionist(auth.uid())) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT id, transaction_number, guest_id, room_id, package_id, status
  INTO selected_transaction
  FROM public.transactions
  WHERE id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan';
  END IF;

  IF selected_transaction.status <> 'booking' THEN
    RAISE EXCEPTION 'Transaksi tidak dapat di-check-in';
  END IF;

  IF selected_transaction.guest_id IS NULL OR selected_transaction.room_id IS NULL OR selected_transaction.package_id IS NULL THEN
    RAISE EXCEPTION 'Data transaksi tidak lengkap';
  END IF;

  SELECT duration_minutes
  INTO selected_duration
  FROM public.packages
  WHERE id = selected_transaction.package_id
    AND active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paket tidak tersedia';
  END IF;

  UPDATE public.rooms
  SET status = 'occupied'
  WHERE id = selected_transaction.room_id
    AND status = 'ready'
    AND active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kamar tidak tersedia';
  END IF;

  UPDATE public.transactions
  SET
    status = 'check_in',
    started_at = now(),
    ends_at = now() + selected_duration * interval '1 minute'
  WHERE id = selected_transaction.id;

  RETURN selected_transaction.transaction_number;
END;
$$;

REVOKE ALL ON FUNCTION public.check_in_booking(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_in_booking(uuid) TO authenticated;

-- The legacy RPC created a second transaction and omitted package/time/payment fields.
DROP FUNCTION IF EXISTS public.create_checkin(uuid, uuid, uuid);
