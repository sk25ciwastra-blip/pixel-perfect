-- Disposable PostgreSQL only; never use on LIVE.
-- Verify that phone/email edits produce exactly their own field-level audit
-- with old/new values, actor, time, and zero unrelated address/name changes.
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);

INSERT INTO public.guests(id,full_name,address,phone,notes)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','TAMU UJI SINTETIS','Alamat Lama','081234567890','');

UPDATE public.guests SET email='tamu@example.com'
WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';

DO $test$
BEGIN
  IF (SELECT count(*) FROM public.guest_profile_history
      WHERE guest_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 1
  THEN RAISE EXCEPTION 'Email-only edit must create exactly one audit event'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.guest_profile_history
      WHERE guest_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' AND field_name='email'
        AND old_value IS NULL AND new_value='tamu@example.com'
        AND changed_by='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
        AND actor_name='Pemilik' AND actor_role='owner' AND changed_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Email before/after/actor/time audit missing'; END IF;

  IF (SELECT address FROM public.guests WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 'Alamat Lama'
  THEN RAISE EXCEPTION 'Unrelated address silently changed'; END IF;
END $test$;

UPDATE public.guests SET phone='+6285699998888'
WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';

DO $test$
BEGIN
  IF (SELECT count(*) FROM public.guest_profile_history
      WHERE guest_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 2
  THEN RAISE EXCEPTION 'Phone edit must add exactly one audit event'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.guest_profile_history
      WHERE guest_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' AND field_name='phone'
        AND old_value='081234567890' AND new_value='+6285699998888'
        AND changed_by='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
        AND actor_name='Pemilik')
  THEN RAISE EXCEPTION 'WhatsApp old/new/audit actor missing'; END IF;
END $test$;

UPDATE public.guests SET phone='+6285699998888'
WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';

DO $test$
BEGIN
  IF (SELECT count(*) FROM public.guest_profile_history
      WHERE guest_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 2
  THEN RAISE EXCEPTION 'No-op phone update must not create phantom history'; END IF;
END $test$;

UPDATE public.guests SET email=NULL
WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.guest_profile_history
      WHERE guest_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') <> 3
  THEN RAISE EXCEPTION 'Clearing email must produce one audit'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.guest_profile_history
      WHERE guest_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' AND field_name='email'
        AND old_value='tamu@example.com' AND new_value IS NULL)
  THEN RAISE EXCEPTION 'Email removal audit missing'; END IF;
  IF EXISTS (SELECT 1 FROM public.guest_profile_history
      WHERE guest_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
        AND field_name NOT IN ('email','phone'))
  THEN RAISE EXCEPTION 'Unrelated name/address audit generated'; END IF;
END $test$;
SELECT 'PASS isolated WhatsApp/Email per-field changes with old-new/actor/time' AS result;
