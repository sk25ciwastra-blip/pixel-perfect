import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
const sql = readFileSync('scripts/issue-140-catalog-compatibility-readonly.sql','utf8');
test('catalog audit is SELECT-only and never reads guest/payment rows',()=>{
 expect(sql).toContain('CATALOG_ONLY_NOT_MIGRATION_REHEARSAL');
 for (const term of ['pg_proc','pg_trigger','has_function_privilege','definition_sha256','security_definer','catalog_prerequisites'])expect(sql).toContain(term);
 expect(sql).not.toMatch(/^\s*(?:create|alter|drop|update|insert|delete|grant|revoke)\s/im);
 expect(sql).not.toContain('FROM public.guests');
 expect(sql).not.toContain('FROM public.payments');
 expect(sql).toContain('full-schema isolated clone');
});
