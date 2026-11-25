import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
const sql=readFileSync('supabase/pending/20261125_b25_payment_method_policy_owner_draft.sql','utf8');
test('migration is isolated single transaction, not deployed',()=>{
  expect(sql.startsWith('-- Baturaden 25 Homestay')).toBe(true);
  expect(sql).toContain('DRAFT ONLY');
  expect((sql.match(/^BEGIN;$/gm)||[]).length).toBe(1);
  expect((sql.match(/^COMMIT;$/gm)||[]).length).toBe(1);
  expect(sql).toContain('SET LOCAL lock_timeout');
  expect(sql).toContain('SET LOCAL statement_timeout');
  expect(sql).toContain("to_regprocedure('public.finance_training_is_restricted(uuid)')");
  expect(sql).toContain("to_regclass('public.payments')");
  expect(sql).toContain("to_regclass('public.b25_payment_method_settings')");
  expect(sql).not.toMatch(/^\s*(?:DELETE|TRUNCATE|DROP TABLE|ALTER TABLE public\.payments|UPDATE public\.payments)\b/gm);
});
test('RLS, revoke, Owner-only access, no public table grants',()=>{
  expect(sql).toContain('ALTER TABLE public.b25_payment_method_settings ENABLE ROW LEVEL SECURITY');
  expect(sql).toContain('ALTER TABLE public.b25_payment_method_audit ENABLE ROW LEVEL SECURITY');
  expect(sql).toContain('REVOKE ALL ON public.b25_payment_method_settings, public.b25_payment_method_audit FROM PUBLIC, anon, authenticated');
  expect(sql).toContain("public.has_role(actor, 'owner'::public.app_role)");
  expect(sql).toContain('public.finance_training_is_restricted(actor) IS DISTINCT FROM FALSE');
  expect(sql).toContain("public.has_role(actor, 'owner'::public.app_role) IS DISTINCT FROM TRUE");
  expect(sql).toContain('auth.uid()');
  expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.b25_read_payment_method_settings() TO authenticated');
  expect(sql).not.toContain('GRANT SELECT ON public.b25_payment_method_settings');
});
test('every new payment passes through server trigger, never rewrite old payments',()=>{
  expect(sql).toContain('BEFORE INSERT ON public.payments FOR EACH ROW');
  expect(sql).toContain('FOR SHARE');
  expect(sql).toContain('FOR UPDATE');
  expect(sql).toContain('CREATE FUNCTION public.b25_guard_payment_method()');
  expect(sql).toContain('IF s.enforcement_enabled THEN');
  expect(sql).toContain("WHEN 'CASH' THEN s.cash_enabled");
  expect(sql).toContain("WHEN 'QRIS' THEN s.qris_enabled");
  expect(sql).toContain("WHEN 'TRANSFER' THEN s.transfer_enabled");
  expect(sql).toContain('enforcement_enabled boolean NOT NULL DEFAULT false');
  expect(sql).toContain('cash_enabled boolean NOT NULL DEFAULT true');
  expect(sql).toContain('CONSTRAINT b25_at_least_one_payment_method');
});
test('audit append only, optimistic revision, no-op and rollback checklist',()=>{
  expect(sql).toContain('CREATE TABLE public.b25_payment_method_audit');
  expect(sql).toContain("action IN ('METHOD_CHANGE','ENFORCEMENT_CHANGE')");
  expect(sql).toContain('revision = revision + 1');
  expect(sql).toContain('_expected_revision IS DISTINCT FROM s.revision');
  expect(sql).toContain('IF s.enforcement_enabled IS NOT DISTINCT FROM _enabled THEN');
  expect(sql).toContain('ROLLBACK (SEPARATELY AUTHORIZED)');
});
