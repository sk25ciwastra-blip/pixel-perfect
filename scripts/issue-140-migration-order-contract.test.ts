import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const training = readFileSync('supabase/migrations/20261018000000_finance_training_enforcement.sql','utf8');
const quote = readFileSync('supabase/pending/20261123084929_booking_quote_read_guards.sql','utf8');
const offer = readFileSync('supabase/pending/20261123101906_issue_140_offer_queue.sql','utf8');
const preflight = readFileSync('scripts/issue-140-release-gate-readonly.sql','utf8');

test('Source order: actual Training enforcement, quote-read, then offer queue', () => {
  expect(training).toMatch(/CREATE OR REPLACE FUNCTION public\.finance_training_is_restricted\s*\(/i);
  expect(training).toMatch(/CREATE OR REPLACE FUNCTION public\.finance_is_booking_operator\s*\(/i);
  expect(training).toMatch(/CREATE OR REPLACE FUNCTION public\.finance_prepare_payment\s*\(/i);
  expect(quote).toMatch(/create function booking_quote_private\.require_operator\s*\(/i);
  expect(quote).toMatch(/create function public\.get_booking_quote_minimum_dp\s*\(/i);
  expect(quote).toMatch(/create function public\.check_booking_quote_schedule\s*\(/i);
  expect(offer).toMatch(/'public\.finance_training_is_restricted\(uuid\)'/);
  expect(offer).toMatch(/'booking_quote_private\.require_operator\(\)'/);
  expect(offer).toMatch(/'public\.get_booking_quote_minimum_dp\(\)'/);
  expect(offer).toMatch(/'public\.check_booking_quote_schedule\(uuid,uuid,timestamp with time zone\)'/);
});

test('Offer conversion uses verified payment and official booking writer in one transaction', () => {
  expect(offer.trimStart().toLowerCase().startsWith('begin;')).toBe(true);
  expect(offer.trimEnd().toLowerCase().endsWith('commit;')).toBe(true);
  expect(offer).toContain("_payment_verified is distinct from true");
  expect(offer).toContain("_amount < t.dp");
  expect(offer).toContain("finance_training_is_restricted(auth.uid())");
  expect(offer).toContain("finance_is_booking_operator(auth.uid())");
  expect(offer).toContain("number := public.create_reservation(");
  expect(offer).toContain("status = 'CONVERTED'");
  expect(offer).toContain("q.booking_key");
});

test('Preflight is strictly catalog inspection, not a staging deployment permission', () => {
  expect(preflight).toContain("HOLD_MISSING_DEPENDENCY");
  expect(preflight).toContain("CATALOG_CHECKS_ONLY_FURTHER_REHEARSAL_REQUIRED");
  expect(preflight).toContain("Compare definitions/ACL and test on approved isolated clone");
  expect(preflight).toContain('finance_prepare_payment_trigger');
  expect(preflight).toContain('payments_transaction_state_guard_trigger');
});

test('Training payment guard preserves Owner/Supervisor Bantu Sesi Aktif alongside assigned Trainee', () => {
  const body = training.match(/CREATE OR REPLACE FUNCTION public\.finance_prepare_payment\(\)[\s\S]*?\$function\$;/i)?.[0] ?? '';
  expect(body).toMatch(/selected_session\.opened_by\s*<>\s*NEW\.recorded_by[\s\S]*?AND NOT public\.finance_is_owner_or_supervisor\(NEW\.recorded_by\)[\s\S]*?AND NOT public\.finance_training_context_matches_session\(/);
});
