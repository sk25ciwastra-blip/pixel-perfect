// Source contract checks only. NOT a PostgreSQL/runtime test.
// Run: node --test scripts/p0-checkout-refund-parity-contract.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const candidatePath = resolve(__dirname, '../supabase/pending/20261122000002_checkout_settlement_refund_safe_review.sql');
const oldPath = resolve(__dirname, '../supabase/migrations/20261019000001_harden_checkout_payment_settlement.sql');
const candidate = readFileSync(candidatePath, 'utf8');
const historical = readFileSync(oldPath, 'utf8');
const checkoutSection = candidate.split('CREATE OR REPLACE FUNCTION public.check_out_transaction')[1];

test('review-only, fail-closed migration not auto-applied', () => {
  assert.match(candidatePath, /supabase[/\\]pending[/\\]/);
  assert.match(candidate, /REVIEW ONLY/);
  assert.match(candidate, /BEGIN;/);
  assert.match(candidate, /COMMIT;/);
  assert.match(candidate, /STOP: partial or existing settlement migration/);
  assert.match(candidate, /eaa0b3e3cf13478999dee8daaa9b2e92/);
  assert.match(candidate, /80bcdeabfc038907ee6dcea4d9d0e714/);
});

test('checkout locks the same transaction before calculating exact settlement', () => {
  assert.ok(checkoutSection, 'checkout RPC must be present');
  const locked = checkoutSection.indexOf('FOR UPDATE');
  const amount = checkoutSection.indexOf('net_paid:=gross_paid-refunded_amount;');
  assert.ok(locked >= 0 && amount > locked);
  assert.match(checkoutSection, /settlement_due:=base_amount\+charge_amount;/);
  assert.match(checkoutSection, /IF net_paid<settlement_due THEN/);
  assert.match(checkoutSection, /IF net_paid>settlement_due THEN/);
  assert.match(checkoutSection, /IF auth\.uid\(\) IS NULL/);
  assert.match(checkoutSection, /status='dirty'/);
  assert.match(checkoutSection, /checked_out_at=now\(\)/);
});

test('payment and charge state guards lock transaction rows and forbid closed writes', () => {
  assert.match(candidate, /CREATE TRIGGER payments_transaction_state_guard_trigger[\s\S]*?ON public\.payments/);
  assert.match(candidate, /CREATE TRIGGER charge_events_transaction_state_guard_trigger[\s\S]*?ON public\.finance_charge_events/);
  assert.ok(candidate.split('FOR UPDATE;').length >= 4);
  assert.match(candidate, /tx_status IN \('check_out','cancelled'\)/);
  assert.match(candidate, /NEW\.transaction_id IS DISTINCT FROM OLD\.transaction_id/);
});

test('Owner refund path deliberately remains callable after checkout', () => {
  assert.match(historical, /CREATE TRIGGER refunds_transaction_state_guard_trigger/);
  assert.doesNotMatch(candidate, /CREATE TRIGGER refunds_transaction_state_guard_trigger/);
  assert.doesNotMatch(candidate, /CREATE TRIGGER[\s\S]{0,210}\bON public\.finance_refunds\b/);
  assert.match(candidate, /public\.create_finance_refund/);
  assert.match(candidate, /finance_refund_source_session_guard_trigger/);
  assert.match(candidate, /has_table_privilege\('authenticated','public\.finance_refunds','INSERT'\)/);
  assert.doesNotMatch(candidate, /UPDATE public\.finance_refunds\s+SET/);
});

test('no cash session, employee, demo or history rows are changed by the candidate', () => {
  assert.doesNotMatch(candidate, /UPDATE public\.finance_cash_sessions/i);
  assert.doesNotMatch(candidate, /UPDATE public\.employees/i);
  assert.doesNotMatch(candidate, /UPDATE public\.payments\b/i);
  assert.doesNotMatch(candidate, /DELETE FROM public\./i);
  assert.doesNotMatch(candidate, /TRUNCATE\s+/i);
  assert.doesNotMatch(candidate, /demo_archived_at\s*=/i);
});

test('SECURITY DEFINER helpers have empty search_path and are not app RPCs', () => {
  assert.match(candidate, /CREATE FUNCTION public\.guard_payment_transaction_state\(\)[\s\S]*?SECURITY DEFINER SET search_path=''/);
  assert.match(candidate, /CREATE FUNCTION public\.guard_charge_transaction_state_review\(\)[\s\S]*?SECURITY DEFINER SET search_path=''/);
  assert.match(candidate, /REVOKE ALL ON FUNCTION public\.guard_payment_transaction_state\(\) FROM PUBLIC,anon,authenticated/);
  assert.match(candidate, /REVOKE ALL ON FUNCTION public\.guard_charge_transaction_state_review\(\) FROM PUBLIC,anon,authenticated/);
});
