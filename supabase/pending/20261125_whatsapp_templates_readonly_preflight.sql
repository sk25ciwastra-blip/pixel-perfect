-- Baturaden 25 Homestay — WhatsApp Poin 4 RELEASE PREFLIGHT
-- READ-ONLY. Do not apply migration from this file.
-- Run on a specifically identified TARGET (staging vs LIVE), record project ref and timestamp.
-- This file intentionally avoids all customer, financial and identity rows.
SELECT current_database() AS database_name,
       current_setting('server_version') AS postgres_version,
       now() AS checked_at;

WITH required_objects(kind,object_name,exists_now) AS (
  VALUES
  ('table','public.user_roles',to_regclass('public.user_roles') IS NOT NULL),
  ('table','public.employees',to_regclass('public.employees') IS NOT NULL),
  ('table','public.transactions',to_regclass('public.transactions') IS NOT NULL),
  ('table','public.receipt_template_versions',to_regclass('public.receipt_template_versions') IS NOT NULL),
  ('type','public.app_role',to_regtype('public.app_role') IS NOT NULL),
  ('function','public.has_role(uuid,public.app_role)',
    to_regprocedure('public.has_role(uuid,public.app_role)') IS NOT NULL),
  ('function','public.finance_training_current_user_is_restricted()',
    to_regprocedure('public.finance_training_current_user_is_restricted()') IS NOT NULL),
  ('function','public.read_payment_confirmation_refunds(uuid)',
    to_regprocedure('public.read_payment_confirmation_refunds(uuid)') IS NOT NULL),
  ('template','public.whatsapp_template_versions',
    to_regclass('public.whatsapp_template_versions') IS NOT NULL),
  ('template','public.whatsapp_template_audit',
    to_regclass('public.whatsapp_template_audit') IS NOT NULL),
  ('template','public.owner_save_whatsapp_template(text,text)',
    to_regprocedure('public.owner_save_whatsapp_template(text,text)') IS NOT NULL),
  ('template','public.read_active_whatsapp_template(text)',
    to_regprocedure('public.read_active_whatsapp_template(text)') IS NOT NULL)
)
SELECT kind,object_name,
  CASE WHEN exists_now THEN 'PRESENT' ELSE 'MISSING' END AS status
FROM required_objects ORDER BY kind,object_name;

-- Compare table signatures, without exposing any table content.
SELECT table_name,column_name,data_type,udt_name,is_nullable
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('user_roles','employees','transactions',
    'receipt_template_versions','whatsapp_template_versions','whatsapp_template_audit')
  AND column_name IN ('user_id','role','position','active','kind','revision',
    'body','status','created_by','created_at','transaction_number','updated_at',
    'template_kind','header_config')
ORDER BY table_name,ordinal_position;

-- Training function's SECURITY DEFINER / volatility and grants must be
-- reviewed manually by an authorized reviewer before LIVE activation.
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer,p.provolatile AS volatility
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
 'has_role','finance_training_current_user_is_restricted',
 'read_payment_confirmation_refunds','owner_save_whatsapp_template',
 'read_active_whatsapp_template')
ORDER BY p.proname;

-- Gate:
-- Missing finance/refund or Training guard => NO-GO for full operational release.
-- Missing WhatsApp template objects => expected before approved migration.
-- Do NOT execute the pending migration without Owner's separate explicit approval.
