import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/pending/20261125_b25_homestay_profile_owner_only.sql','utf8');
const ui = readFileSync('src/routes/pengaturan-profil-homestay.tsx','utf8');
const menu = readFileSync('src/routes/pengaturan.tsx','utf8');

test('profile UI links from Owner settings and has no public write', () => {
  assert.match(menu, /label: "Profil Homestay"[^\n]*ke: "\/pengaturan-profil-homestay"/);
  assert.match(menu, /peran === "owner" \? kelompok/);
  assert.match(ui, /if \(!owner\)/);
  assert.match(ui, /if \(!owner \|\| !profil \|\| loading \|\| saving\) return/);
  assert.match(ui, /b25_save_homestay_profile/);
  assert.match(ui, /b25_read_homestay_profile/);
  assert.match(ui, /disabled=\{!profil \|\| saving \|\| loading\}/);
  assert.doesNotMatch(ui, /supabase\.from\(/);
});
test('SQL uses Owner-only server authorization, append-only history, RLS, and no open table grants', () => {
  assert.match(sql, /CREATE TABLE public\.b25_homestay_profile\(/);
  assert.match(sql, /CREATE TABLE public\.b25_homestay_profile_audit\(/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/g);
  assert.match(sql, /public\.has_role\(actor,'owner'::public\.app_role\)/);
  assert.match(sql, /public\.finance_training_is_restricted\(actor\)/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /INSERT INTO public\.b25_homestay_profile_audit/);
  assert.match(sql, /REVOKE ALL ON public\.b25_homestay_profile, public\.b25_homestay_profile_audit FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(sql, /GRANT (INSERT|UPDATE|DELETE) ON (TABLE )?public\.b25_homestay_profile/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.b25_save_homestay_profile.* TO authenticated/);
});
