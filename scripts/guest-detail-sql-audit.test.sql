-- Tested only in ephemeral PostgreSQL docker; never run this against LIVE.
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
INSERT INTO public.guests(id,full_name,address,phone,notes)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ANDI','Bandung','081200000000','');

UPDATE public.guests SET address='Kiara Condong',phone='+6281200000000',email='andi@example.com'
WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

DO $test$
DECLARE n integer; v text;
BEGIN
  SELECT count(*) INTO n FROM public.guest_profile_history WHERE guest_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF n<>3 THEN RAISE EXCEPTION 'Expected 3 address phone email audits, got %',n; END IF;

  SELECT old_value INTO v FROM public.guest_profile_history WHERE field_name='address';
  IF v<>'Bandung' THEN RAISE EXCEPTION 'Old address not recorded'; END IF;
  SELECT new_value INTO v FROM public.guest_profile_history WHERE field_name='address';
  IF v<>'Kiara Condong' THEN RAISE EXCEPTION 'New address not recorded'; END IF;

  IF EXISTS (SELECT 1 FROM public.guest_profile_history WHERE changed_by IS DISTINCT FROM 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid OR actor_name<>'Pemilik')
  THEN RAISE EXCEPTION 'Actor attribution incorrect'; END IF;

  IF EXISTS(SELECT 1 FROM public.guest_profile_history WHERE field_name NOT IN ('address','phone','email'))
  THEN RAISE EXCEPTION 'Unchanged fields should not generate audit'; END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.guest_profile_history'::regclass)
  THEN RAISE EXCEPTION 'Audit RLS is not enabled'; END IF;
  IF has_table_privilege('authenticated','public.guest_profile_history','UPDATE')
    OR has_table_privilege('authenticated','public.guest_profile_history','DELETE')
    OR has_table_privilege('authenticated','public.guest_profile_history','INSERT')
  THEN RAISE EXCEPTION 'Audit is writable by browser role'; END IF;
  IF has_schema_privilege('authenticated','b25_guest_internal','USAGE')
  THEN RAISE EXCEPTION 'Trigger code must stay private'; END IF;
END $test$;

UPDATE public.guests SET full_name='ANDI SUPRIADI' WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $test$
BEGIN
 IF (SELECT count(*) FROM public.guest_profile_history WHERE field_name='full_name')<>1
 THEN RAISE EXCEPTION 'Renamed guest audit missing'; END IF;
END $test$;

-- Update without any material change must not invent a history item.
UPDATE public.guests SET address='Kiara Condong' WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $test$
BEGIN
 IF (SELECT count(*) FROM public.guest_profile_history)<>4 THEN
   RAISE EXCEPTION 'No-op update generated phantom history';
 END IF;
END $test$;

SELECT public.b25_add_guest_categorized_note(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Suka kamar lantai 2','preferensi');
SELECT public.b25_add_guest_categorized_note(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Perlu perhatian jadwal','perhatian');

DO $test$
BEGIN
 IF (SELECT count(*) FROM public.guest_notes WHERE note_type='preferensi')<>1 OR
    (SELECT count(*) FROM public.guest_notes WHERE note_type='perhatian')<>1
 THEN RAISE EXCEPTION 'Categorized notes not persisted'; END IF;
 IF EXISTS(SELECT 1 FROM public.guest_notes WHERE author_id IS DISTINCT FROM 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid)
 THEN RAISE EXCEPTION 'Note actor must come from auth.uid'; END IF;
END $test$;

-- Verify unauthorized callers are refused even though the function is security-definer.
SELECT set_config('request.jwt.claim.sub','','false');
DO $test$
BEGIN
  BEGIN
    PERFORM public.b25_add_guest_categorized_note('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Tidak boleh','umum');
    RAISE EXCEPTION 'SECURITY_TEST_FAILED unauthorized note insert was accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- expected
  END;
END $test$;
SELECT 'PASS guest history and typed notes SQL migration (ephemeral Postgres only)' AS result;
