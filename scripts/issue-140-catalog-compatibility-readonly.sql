-- Issue #140 — catalog-level compatibility only (SELECT only, no PII or data mutation).
-- Intentionally does not install Training, Quote-Read, or Offer migration.
WITH required(name,kind,identifier) AS (VALUES
 ('booking_writer','function','public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid)'),
 ('finance_sessions','relation','public.finance_cash_sessions'),
 ('finance_settings','relation','public.finance_settings'),
 ('finance_commission','relation','public.finance_commission_configs'),
 ('finance_bank','relation','public.finance_bank_accounts'),
 ('finance_allocations','relation','public.finance_session_allocations'),
 ('finance_handoffs','relation','public.finance_drawer_handoffs'),
 ('finance_charge','relation','public.finance_charge_events'),
 ('finance_refunds','relation','public.finance_refunds'),
 ('finance_expenses','relation','public.finance_expenses'),
 ('finance_deposits','relation','public.finance_deposits'),
 ('room_status_enum','type','public.room_status'),
 ('role_enum','type','public.app_role'),
 ('has_role','function','public.has_role(uuid,public.app_role)'),
 ('has_position','function','public.has_employee_position(uuid,public.employee_position[])'),
 ('schedule_calculation','function','public.calculate_scheduled_booking_times(uuid,timestamptz)'),
 ('finance_prepare_payment','function','public.finance_prepare_payment()')
), catalog AS (
 SELECT name,
   CASE kind WHEN 'relation' THEN to_regclass(identifier) IS NOT NULL
             WHEN 'type' THEN to_regtype(identifier) IS NOT NULL
             ELSE to_regprocedure(identifier) IS NOT NULL END AS present
 FROM required
), protected_writers AS (
 SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS signature,
        pg_get_userbyid(p.proowner) AS owner_role, p.prosecdef AS security_definer,
        encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') AS definition_sha256,
        has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
        has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('create_reservation','finance_prepare_payment','finance_is_booking_operator')
), financial_triggers AS (
 SELECT t.tgname AS trigger_name, t.tgenabled AS enabled, pg_get_triggerdef(t.oid) AS definition
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname='payments' AND NOT t.tgisinternal
)
SELECT jsonb_build_object(
 'catalog_prerequisites',(SELECT coalesce(jsonb_object_agg(name,present ORDER BY name),'{}'::jsonb) FROM catalog),
 'all_catalog_prerequisites_present',(SELECT bool_and(present) FROM catalog),
 'official_function_fingerprints',(SELECT coalesce(jsonb_agg(to_jsonb(w) ORDER BY proname,signature),'[]'::jsonb) FROM protected_writers w),
 'payments_triggers',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY trigger_name),'[]'::jsonb) FROM financial_triggers t),
 'gate','CATALOG_ONLY_NOT_MIGRATION_REHEARSAL',
 'next_step','Owner-approved full-schema isolated clone and replay; compare writer/trigger hashes and ACL before any database writes'
) AS audit_result;
