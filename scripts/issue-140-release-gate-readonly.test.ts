import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
const sql = readFileSync('scripts/issue-140-release-gate-readonly.sql','utf8');
test('Offer release preflight reads catalog only, never changes cloud data',()=>{
  expect(sql).toContain('READ-ONLY release-gate preflight');
  expect(sql).toContain('WITH requirements(');
  expect(sql).toContain('FROM pg_proc');
  expect(sql).toContain('FROM pg_trigger');
  expect(sql).toContain('HOLD_MISSING_DEPENDENCY');
  expect(sql).toContain('HOLD_FINANCE_GUARD');
  expect(sql).toContain('CATALOG_CHECKS_ONLY_FURTHER_REHEARSAL_REQUIRED');
  expect(sql).not.toMatch(/\b(?:insert\s+into|update\s+public\.|delete\s+from|truncate\s+|create\s+(?:table|function|trigger|schema)|alter\s+table|drop\s+(?:table|function)|grant\s+|revoke\s+)\b/i);
  expect(sql).not.toContain('g.phone');
  expect(sql).not.toContain('g.full_name');
  expect(sql).not.toContain('payments.amount');
});
test('mandatory prerequisites include Training, quote and financial safeguards',()=>{
  for(const term of ['finance_training_is_restricted','booking_quote_private.require_operator',
    'get_booking_quote_minimum_dp','check_booking_quote_schedule','finance_prepare_payment_trigger',
    'payments_transaction_state_guard_trigger','create_reservation','reservation_offers'])expect(sql).toContain(term);
  expect(sql).toContain('Compare definitions/ACL and test on approved isolated clone');
});
