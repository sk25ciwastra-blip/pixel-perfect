-- Baturaden 25 Homestay | DEMO employee classification (read-only)
-- Never classify DEMO solely because ID is not yet B25EMP-xxx.
-- Do not export employee names, emails, or auth user IDs into this report.
WITH employees AS (
 SELECT
   e.id,
   e.employee_id,
   e.position::text AS position,
   e.active,
   (
      e.employee_id LIKE 'KR-DEMO-%'
      OR e.employee_id LIKE 'QA-%'
      OR lower(e.name) LIKE '%demo%'
   ) AS has_explicit_demo_label
 FROM public.employees e
)
SELECT
 (SELECT count(*)::int FROM employees) AS employee_total,
 (SELECT count(*)::int FROM employees WHERE has_explicit_demo_label) AS explicitly_demo_labeled,
 (SELECT count(*)::int FROM employees WHERE NOT has_explicit_demo_label) AS not_demo_labeled_protect_until_verified,
 (SELECT count(*)::int FROM employees WHERE NOT has_explicit_demo_label AND position='supervisor') AS unverified_supervisor_accounts,
 (SELECT count(*)::int FROM employees WHERE NOT has_explicit_demo_label AND position='housekeeping') AS unverified_housekeeping_accounts,
 (SELECT count(*)::int FROM public.employees WHERE employee_id LIKE 'B25EMP-%') AS b25emp_real_namespace_count,
 (SELECT count(*)::int FROM public.transactions) AS operational_transactions,
 (SELECT count(*)::int FROM public.payments) AS operational_payments,
 (SELECT count(*)::int FROM public.finance_cash_sessions) AS cash_sessions,
 (SELECT count(*)::int FROM auth.users) AS auth_users,
 to_regprocedure('public.allocate_b25_employee_id()') IS NOT NULL AS official_employee_allocator_exists;
