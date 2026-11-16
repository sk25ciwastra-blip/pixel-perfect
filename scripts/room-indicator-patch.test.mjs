import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

// Exact helper excerpt copied from the pinned Lovable source 3218bd2,
// not a live/production file; GitHub main is NOT the source of truth here.
const pinned = `function formatIssueDetails(checklist: ChecklistRow) {
  return [
    !checklist.ashtray_ok && (checklist.ashtray_reason || "Asbak"),
    !checklist.exhaust_fan_ok && (checklist.exhaust_fan_reason || "Kipas exhaust"),
    !checklist.fan_ok && (checklist.fan_reason || "Kipas"),
    !checklist.mineral_water_ok && (checklist.mineral_water_reason || "Air mineral"),
    !checklist.tissue_ok && (checklist.tissue_reason || "Tisu"),
    !checklist.towel_ok && (checklist.towel_reason || "Handuk"),
    !checklist.tv_remote_ok && (checklist.tv_remote_reason || "Remote TV"),
    checklist.issue_note.trim(),
  ].filter((item): item is string => Boolean(item));
}`;
const patch = `diff --git a/src/routes/kamar.tsx b/src/routes/kamar.tsx
--- a/src/routes/kamar.tsx
+++ b/src/routes/kamar.tsx
@@ -64,6 +64,5 @@ function formatIssueDetails(checklist: ChecklistRow) {
     !checklist.tissue_ok && (checklist.tissue_reason || "Tisu"),
     !checklist.towel_ok && (checklist.towel_reason || "Handuk"),
     !checklist.tv_remote_ok && (checklist.tv_remote_reason || "Remote TV"),
-    checklist.issue_note.trim(),
   ].filter((item): item is string => Boolean(item));
 }
`;
const work = mkdtempSync(join(tmpdir(), 'b25-room-indicator-'));
let fixed;
try {
  const route = join(work, 'src', 'routes', 'kamar.tsx');
  mkdirSync(join(work, 'src', 'routes'), { recursive: true });
  writeFileSync(route, pinned + '\n');
  for (const args of [['apply', '--check', '-'], ['apply', '-']]) {
    const r = spawnSync('git', args, { cwd: work, input: patch, encoding: 'utf8' });
    assert.equal(r.status, 0, `patch command failed: ${r.stderr}`);
  }
  fixed = readFileSync(route, 'utf8').trimEnd();
} finally {
  rmSync(work, { recursive: true, force: true });
}
function asJs(fn) {
  return fn.replace('(checklist: ChecklistRow)', '(checklist)')
    .replace('(item): item is string =>', '(item) =>');
}
const evaluate = vm.runInNewContext(`(${asJs(fixed)})`);
const base = Object.fromEntries(['ashtray','exhaust_fan','fan','mineral_water','tissue','towel','tv_remote'].map(k => [k+'_ok', true]));

test('exact patch removes only audit-note append', () => {
  assert.equal(fixed, pinned.replace('    checklist.issue_note.trim(),\n', ''));
});
test('PASS: no false red X from nonempty all-CENTANG audit note', () => {
  assert.deepEqual(Array.from(evaluate({ ...base, issue_note: 'Handuk: CENTANG; TV: CENTANG' })), []);
});
test('one failed item: only its reason, not full audit note', () => {
  assert.deepEqual(Array.from(evaluate({ ...base, mineral_water_ok: false, mineral_water_reason: 'stok belum datang', issue_note: 'Handuk: CENTANG; Air mineral: X - stok belum datang' })), ['stok belum datang']);
});
test('multiple failed items: only failing reasons and existing fallback', () => {
  assert.deepEqual(Array.from(evaluate({ ...base, ashtray_ok: false, tissue_ok: false, tissue_reason: 'stok habis', issue_note: 'audit text' })), ['Asbak', 'stok habis']);
});
test('audit note with no failed flags never creates an issue', () => {
  assert.deepEqual(Array.from(evaluate({ ...base, issue_note: 'catatan riwayat positif' })), []);
});
