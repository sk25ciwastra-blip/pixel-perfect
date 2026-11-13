-- PENDING OWNER APPROVAL ONLY. Never apply to Cloud as part of this PR.
-- Independent of #56: no RPC replacement, financial or booking-time changes.
BEGIN;

-- Fail safely on historical duplicates; never repair/close them automatically.
DO $preflight$
BEGIN
  IF EXISTS (
    SELECT room_id FROM public.transactions
    WHERE status = 'check_in' AND room_id IS NOT NULL
    GROUP BY room_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Hunian aktif ganda harus ditinjau Owner sebelum instalasi guard';
  END IF;
END;
$preflight$;
-- Final concurrency backstop even for non-default isolation or privileged writes.
CREATE UNIQUE INDEX room_single_active_checkin
ON public.transactions(room_id) WHERE status = 'check_in' AND room_id IS NOT NULL;

CREATE TABLE public.room_overtime_owner_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  room_id uuid NOT NULL REFERENCES public.rooms(id),
  checkout_deadline timestamptz NOT NULL,
  actor_id uuid NOT NULL,
  released_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  action text NOT NULL DEFAULT 'RELEASE_OVERTIME_WALKIN_BLOCK'
    CHECK (action = 'RELEASE_OVERTIME_WALKIN_BLOCK'),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 5 AND 300),
  UNIQUE (transaction_id, room_id, checkout_deadline)
);
ALTER TABLE public.room_overtime_owner_releases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.room_overtime_owner_releases FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.room_overtime_owner_releases TO authenticated;
CREATE POLICY room_overtime_releases_owner_read
ON public.room_overtime_owner_releases FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner')
       AND NOT public.finance_training_current_user_is_restricted());

CREATE FUNCTION public.release_room_overtime_block(_transaction_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  selected_room uuid;
  active_stay record;
  audit_id uuid;
BEGIN
  -- Identity and role are never accepted as caller-supplied parameters.
  IF auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'owner') IS NOT TRUE
     OR public.finance_training_is_restricted(auth.uid()) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) NOT BETWEEN 5 AND 300 THEN
    RAISE EXCEPTION 'Alasan audit wajib diisi (5-300 karakter)';
  END IF;
  -- Match existing transaction-resolution RPC order: transaction, then room.
  SELECT room_id INTO selected_room FROM public.transactions
  WHERE id = _transaction_id FOR UPDATE;
  IF selected_room IS NULL THEN RAISE EXCEPTION 'Kasus overtime tidak tersedia'; END IF;
  PERFORM 1 FROM public.rooms WHERE id = selected_room FOR UPDATE;
  SELECT room_id, ends_at, status INTO active_stay
  FROM public.transactions WHERE id = _transaction_id;
  IF NOT FOUND OR active_stay.room_id IS DISTINCT FROM selected_room
     OR active_stay.status <> 'check_in' OR active_stay.ends_at IS NULL
     OR clock_timestamp() <= active_stay.ends_at + interval '120 minutes' THEN
    RAISE EXCEPTION 'Kasus overtime tidak tersedia';
  END IF;
  INSERT INTO public.room_overtime_owner_releases
    (transaction_id, room_id, checkout_deadline, actor_id, reason)
  VALUES (_transaction_id, selected_room, active_stay.ends_at, auth.uid(), btrim(_reason))
  ON CONFLICT (transaction_id, room_id, checkout_deadline) DO NOTHING
  RETURNING id INTO audit_id;
  IF audit_id IS NULL THEN
    SELECT id INTO audit_id FROM public.room_overtime_owner_releases
    WHERE transaction_id = _transaction_id AND room_id = selected_room
      AND checkout_deadline = active_stay.ends_at;
  END IF;
  -- Does not checkout, mark READY, change a deadline, or bypass occupancy.
  RETURN audit_id;
END;
$function$;

CREATE FUNCTION public.guard_room_overtime_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE direct_arrival boolean;
BEGIN
  IF NEW.status <> 'check_in' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'check_in' AND OLD.room_id IS NOT DISTINCT FROM NEW.room_id THEN
      RETURN NEW;
    END IF;
    direct_arrival := OLD.status <> 'booking';
  ELSE
    direct_arrival := true;
  END IF;
  -- Serializes both RPCs and direct RLS writes on the same physical room.
  PERFORM 1 FROM public.rooms WHERE id = NEW.room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kamar tidak tersedia'; END IF;
  IF direct_arrival AND EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.room_id = NEW.room_id AND t.id IS DISTINCT FROM NEW.id
      AND t.status = 'check_in'
      AND clock_timestamp() > t.ends_at + interval '120 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM public.room_overtime_owner_releases a
        WHERE a.transaction_id = t.id AND a.room_id = t.room_id
          AND a.checkout_deadline = t.ends_at
      )
  ) THEN
    RAISE EXCEPTION 'Walk-in diblokir: overtime lebih dari 120 menit memerlukan penyelesaian';
  END IF;
  -- A release never permits another guest while the former stay is active.
  -- Booking check-in does NOT receive the overtime gate; occupancy still applies.
  IF EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.room_id = NEW.room_id AND t.id IS DISTINCT FROM NEW.id
      AND t.status = 'check_in'
  ) THEN
    RAISE EXCEPTION 'Kamar masih memiliki transaksi hunian aktif';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER room_overtime_checkin_guard
BEFORE INSERT OR UPDATE OF status, room_id ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_room_overtime_checkin();

REVOKE ALL ON FUNCTION public.release_room_overtime_block(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_room_overtime_block(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.guard_room_overtime_checkin() FROM PUBLIC, anon, authenticated;
COMMIT;
