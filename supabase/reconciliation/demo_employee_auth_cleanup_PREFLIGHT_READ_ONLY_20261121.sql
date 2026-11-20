-- Baturaden 25 Homestay | DEMO employee purge preflight ONLY
-- 21 Nov 2026. No DML. No PII or passwords returned.
-- This SQL does NOT authorize, execute, or certify deletion.
WITH old_staff AS (
 SELECT id,user_id,employee_id,active
 FROM public.employees
 WHERE employee_id NOT LIKE 'B25EMP-%'
), other_accounts AS (
 SELECT a.id FROM auth.users a
 WHERE NOT EXISTS(SELECT 1 FROM old_staff e WHERE e.user_id=a.id)
), stats AS (
 SELECT
  (SELECT count(*)::int FROM public.employees) AS all_staff_records,
  (SELECT count(*)::int FROM old_staff) AS demo_staff_candidates,
  (SELECT count(*)::int FROM public.employees WHERE employee_id LIKE 'B25EMP-%') AS real_namespace_staff,
  (SELECT count(*)::int FROM auth.users a WHERE a.id IN (SELECT user_id FROM old_staff)) AS demo_auth_accounts,
  (SELECT count(*)::int FROM other_accounts) AS protected_nonstaff_auth_accounts,
  (SELECT count(*)::int FROM auth.sessions a WHERE a.user_id IN (SELECT user_id FROM old_staff)) AS demo_auth_sessions,
  (SELECT count(*)::int FROM public.user_roles r WHERE r.user_id IN (SELECT user_id FROM old_staff)) AS demo_role_rows,
  (SELECT count(*)::int FROM public.employee_profiles p WHERE p.employee_id IN (SELECT id FROM old_staff)) AS demo_profiles,
  (SELECT count(*)::int FROM public.activity_logs l WHERE l.user_id IN (SELECT user_id FROM old_staff)) AS demo_actor_activity_logs,
  (SELECT count(*)::int FROM storage.objects s WHERE s.owner IN (SELECT user_id FROM old_staff)
     OR s.owner_id IN (SELECT user_id::text FROM old_staff)) AS demo_employee_storage_objects,
  (SELECT count(*)::int FROM storage.buckets s WHERE s.owner IN (SELECT user_id FROM old_staff)
     OR s.owner_id IN (SELECT user_id::text FROM old_staff)) AS demo_employee_storage_buckets,
  (SELECT count(*)::int FROM public.finance_cash_sessions WHERE status='OPEN') AS open_cash_sessions,
  (SELECT count(*)::int FROM public.transactions) AS transactions,
  (SELECT count(*)::int FROM public.payments) AS payments,
  (SELECT count(*)::int FROM public.rooms) AS rooms_preserve,
  (SELECT count(*)::int FROM public.packages) AS packages_preserve,
  (SELECT count(*)::int FROM public.room_types) AS types_preserve,
  (SELECT count(*)::int FROM public.finance_settings) AS finance_settings_preserve,
  (SELECT count(*)::int FROM public.activity_logs) AS all_activity_logs,
  (SELECT count(*)::int FROM public.rooms WHERE status='occupied') AS occupied_rooms_need_physical_check,
  (SELECT count(*)::int FROM public.rooms WHERE status='dirty') AS dirty_rooms_need_physical_check,
  (SELECT count(*)::int FROM public.room_types WHERE active) AS active_room_types,
  (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p') AND
   (has_table_privilege('anon',c.oid,'TRUNCATE') OR has_table_privilege('authenticated',c.oid,'TRUNCATE'))) AS truncate_permissions_exposed
)
SELECT current_database() AS db, current_setting('server_version_num') AS pg,
 stats.* FROM stats;
