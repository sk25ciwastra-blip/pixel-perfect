-- Baturaden 25 Homestay — Issue #161: Owner payment method controls
-- DRAFT ONLY. DO NOT APPLY TO STAGING, LOVABLE CLOUD OR LIVE WITHOUT OWNER APPROVAL.
-- Deployed defaults: Cash, QRIS and Transfer ON; enforcement OFF until audited UAT.
-- Existing payment history/commissions/refunds untouched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Refuse unknown or partially-installed targets instead of overwriting business logic.
DO $preflight$
BEGIN
  IF to_regclass('public.payments') IS NULL
    OR to_regprocedure('public.has_role(uuid,public.app_role)') IS NULL
    OR to_regprocedure('public.finance_training_is_restricted(uuid)') IS NULL
    OR to_regprocedure('auth.uid()') IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = 'public.payments'::regclass
        AND tgname = 'finance_prepare_payment_trigger' AND NOT tgisinternal
    )
    OR to_regclass('public.b25_payment_method_settings') IS NOT NULL
    OR to_regclass('public.b25_payment_method_audit') IS NOT NULL
    OR to_regprocedure('public.b25_read_payment_method_settings()') IS NOT NULL
    OR to_regprocedure('public.b25_set_payment_method(text,boolean,bigint,text)') IS NOT NULL
    OR to_regprocedure('public.b25_set_payment_enforcement(boolean,bigint,text)') IS NOT NULL
    OR to_regprocedure('public.b25_guard_payment_method()') IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = 'public.payments'::regclass
        AND tgname = 'b25_payment_method_guard_trigger' AND NOT tgisinternal
    )
  THEN
    RAISE EXCEPTION 'STOP #161: target Cloud baseline or installation state differs; compare schema and review rollback before apply';
  END IF;
END;
$preflight$;

CREATE TABLE public.b25_payment_method_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  cash_enabled boolean NOT NULL DEFAULT true,
  qris_enabled boolean NOT NULL DEFAULT true,
  transfer_enabled boolean NOT NULL DEFAULT true,
  enforcement_enabled boolean NOT NULL DEFAULT false,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  CONSTRAINT b25_at_least_one_payment_method CHECK (cash_enabled OR qris_enabled OR transfer_enabled)
);

CREATE TABLE public.b25_payment_method_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('METHOD_CHANGE','ENFORCEMENT_CHANGE')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 500),
  previous_value jsonb NOT NULL,
  next_value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.b25_payment_method_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b25_payment_method_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.b25_payment_method_settings, public.b25_payment_method_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.b25_payment_method_audit_id_seq FROM PUBLIC, anon, authenticated;

INSERT INTO public.b25_payment_method_settings (id, cash_enabled, qris_enabled, transfer_enabled, enforcement_enabled)
VALUES (true, true, true, true, false);

-- Authenticated users (Receptionist / Supervisor) need to read the same effective state.
CREATE FUNCTION public.b25_read_payment_method_settings()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE s public.b25_payment_method_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login diperlukan untuk melihat metode pembayaran'; END IF;
  SELECT * INTO s FROM public.b25_payment_method_settings WHERE id = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Konfigurasi metode pembayaran tidak tersedia'; END IF;
  RETURN jsonb_build_object(
    'revision', s.revision,
    'methods', jsonb_build_object('CASH', s.cash_enabled, 'QRIS', s.qris_enabled, 'TRANSFER', s.transfer_enabled),
    'enforcement_enabled', s.enforcement_enabled,
    'updated_at', s.updated_at
  );
END;
$fn$;

CREATE FUNCTION public.b25_set_payment_method(
  _method text, _enabled boolean, _expected_revision bigint, _reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  actor uuid := auth.uid();
  code text := upper(btrim(coalesce(_method, '')));
  why text := btrim(coalesce(_reason, ''));
  s public.b25_payment_method_settings%ROWTYPE;
  old_value jsonb;
BEGIN
  IF actor IS NULL
     OR public.has_role(actor, 'owner'::public.app_role) IS DISTINCT FROM TRUE
     OR public.finance_training_is_restricted(actor) IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'Hanya Owner aktif yang dapat mengatur metode pembayaran';
  END IF;
  IF code NOT IN ('CASH','QRIS','TRANSFER') OR _enabled IS NULL
     OR char_length(why) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'Metode, status, atau alasan tidak valid';
  END IF;
  SELECT * INTO s FROM public.b25_payment_method_settings WHERE id = true FOR UPDATE;
  IF NOT FOUND OR _expected_revision IS DISTINCT FROM s.revision THEN
    RAISE EXCEPTION 'Konfigurasi berubah; muat ulang sebelum menyimpan';
  END IF;
  IF (code = 'CASH' AND s.cash_enabled = _enabled)
     OR (code = 'QRIS' AND s.qris_enabled = _enabled)
     OR (code = 'TRANSFER' AND s.transfer_enabled = _enabled) THEN
    RETURN public.b25_read_payment_method_settings();
  END IF;
  old_value := jsonb_build_object('CASH',s.cash_enabled,'QRIS',s.qris_enabled,'TRANSFER',s.transfer_enabled,'revision',s.revision);
  UPDATE public.b25_payment_method_settings SET
    cash_enabled = CASE WHEN code = 'CASH' THEN _enabled ELSE cash_enabled END,
    qris_enabled = CASE WHEN code = 'QRIS' THEN _enabled ELSE qris_enabled END,
    transfer_enabled = CASE WHEN code = 'TRANSFER' THEN _enabled ELSE transfer_enabled END,
    revision = revision + 1, updated_at = clock_timestamp(), updated_by = actor
  WHERE id = true;
  -- CHECK prevents all OFF, and rolls back the update + audit transaction.
  INSERT INTO public.b25_payment_method_audit(actor_id,action,reason,previous_value,next_value)
  VALUES (actor,'METHOD_CHANGE',why,old_value,public.b25_read_payment_method_settings());
  RETURN public.b25_read_payment_method_settings();
END;
$fn$;

-- Final activation is separate from editing policy. Enforce only after all
-- server paths, refund edge cases and production schema are approved/rehearsed.
CREATE FUNCTION public.b25_set_payment_enforcement(
  _enabled boolean, _expected_revision bigint, _reason text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  actor uuid := auth.uid();
  why text := btrim(coalesce(_reason, ''));
  s public.b25_payment_method_settings%ROWTYPE;
BEGIN
  IF actor IS NULL
     OR public.has_role(actor, 'owner'::public.app_role) IS DISTINCT FROM TRUE
     OR public.finance_training_is_restricted(actor) IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'Hanya Owner aktif yang dapat mengaktifkan kontrol pembayaran';
  END IF;
  IF _enabled IS NULL OR char_length(why) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'Status atau alasan tidak valid';
  END IF;
  SELECT * INTO s FROM public.b25_payment_method_settings WHERE id = true FOR UPDATE;
  IF NOT FOUND OR _expected_revision IS DISTINCT FROM s.revision THEN
    RAISE EXCEPTION 'Konfigurasi berubah; muat ulang sebelum menyimpan';
  END IF;
  IF s.enforcement_enabled IS NOT DISTINCT FROM _enabled THEN
    RETURN public.b25_read_payment_method_settings();
  END IF;
  UPDATE public.b25_payment_method_settings
     SET enforcement_enabled = _enabled, revision = revision + 1,
         updated_at = clock_timestamp(), updated_by = actor WHERE id = true;
  INSERT INTO public.b25_payment_method_audit(actor_id,action,reason,previous_value,next_value)
  VALUES(actor,'ENFORCEMENT_CHANGE',why,
         jsonb_build_object('enforcement_enabled',s.enforcement_enabled,'revision',s.revision),
         public.b25_read_payment_method_settings());
  RETURN public.b25_read_payment_method_settings();
END;
$fn$;

-- Guard applies to ALL inserts reaching payments, including RPCs and combined
-- payments, without rewriting their financial, commission or refund logic.
-- The row lock prevents a concurrent disable from racing an INSERT.
CREATE FUNCTION public.b25_guard_payment_method()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  s public.b25_payment_method_settings%ROWTYPE;
  code text := upper(btrim(coalesce(NEW.method, '')));
BEGIN
  SELECT * INTO s FROM public.b25_payment_method_settings WHERE id = true FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Konfigurasi metode pembayaran tidak tersedia'; END IF;
  IF s.enforcement_enabled THEN
    IF NOT CASE code
      WHEN 'CASH' THEN s.cash_enabled
      WHEN 'QRIS' THEN s.qris_enabled
      WHEN 'TRANSFER' THEN s.transfer_enabled
      ELSE false
    END THEN
      RAISE EXCEPTION 'Metode pembayaran % tidak aktif; pilih metode lain', code;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER b25_payment_method_guard_trigger
BEFORE INSERT ON public.payments FOR EACH ROW
EXECUTE FUNCTION public.b25_guard_payment_method();

REVOKE ALL ON FUNCTION public.b25_read_payment_method_settings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.b25_set_payment_method(text,boolean,bigint,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.b25_set_payment_enforcement(boolean,bigint,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.b25_guard_payment_method() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.b25_read_payment_method_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.b25_set_payment_method(text,boolean,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.b25_set_payment_enforcement(boolean,bigint,text) TO authenticated;
COMMIT;

-- HOLD: Apply only after owner-approved Cloud/live baseline, backup, and
-- transaction-path rehearsal. Staging has shown missing dependencies.
-- Pre-activation checks: anon, employee, owner/training, concurrent toggle,
-- payment INSERT from all RPCs, combined payments, refunds, charge extensions,
-- idempotent retry; confirm no unrelated regression.
-- ROLLBACK (SEPARATELY AUTHORIZED):
-- 1. Disable enforcement via Owner RPC before any DDL rollback.
-- 2. DROP TRIGGER b25_payment_method_guard_trigger ON public.payments;
-- 3. DROP FUNCTION public.b25_guard_payment_method();
-- 4. DROP FUNCTION public.b25_set_payment_enforcement(boolean,bigint,text);
-- 5. DROP FUNCTION public.b25_set_payment_method(text,boolean,bigint,text);
-- 6. DROP FUNCTION public.b25_read_payment_method_settings();
-- 7. Preserve the settings/audit tables until finance retention approval.
