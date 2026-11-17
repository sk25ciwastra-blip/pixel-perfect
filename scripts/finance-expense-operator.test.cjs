// Focused regression: actual Finance expense-row mapping, no Cloud requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'b25-expense-actor-'));
const relative = 'src/routes/keuangan.tsx';
function mapping(source, rows) {
  const line = source.split('\n').find(line => line.includes('...sessionExpenses.map('));
  assert.ok(line, 'actual expense mapping must exist');
  const expression = line.trim().replace(/^\.\.\./, '').replace(/,$/, '');
  const javascript = ts.transpileModule('return (' + expression + ');', {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const names = { helper: 'Owner operator', receptionist: 'Receptionist owner' };
  return new Function('sessionExpenses', 'nama', javascript)(rows, id => names[id] ?? 'Tidak diketahui');
}
try {
  const original = fs.readFileSync(path.join(root, 'scripts/fixtures/lovable-3218bd2', relative), 'utf8');
  const patch = fs.readFileSync(path.join(root, 'patches/operational-integration-lovable-3218bd2.patch'), 'utf8');
  const start = patch.indexOf('--- a/' + relative + '\n');
  assert.ok(start >= 0);
  const next = patch.indexOf('\n--- ', start + 10);
  const section = patch.slice(start, next < 0 ? undefined : next + 1);
  fs.mkdirSync(path.join(tmp, 'src/routes'), { recursive: true });
  fs.writeFileSync(path.join(tmp, relative), original);
  cp.execFileSync('git', ['apply', '-'], { cwd: tmp, input: section });
  const candidate = fs.readFileSync(path.join(tmp, relative), 'utf8');
  const expense = { id: 'expense-one', recorded_by: 'helper', session_id: 'receptionist-session', amount: 71000, method: 'CASH', category: 'DEMO' };
  assert.equal(mapping(original, [expense])[0].petugas, 'Tidak diketahui', 'baseline defect reproduced');
  for (const source of [candidate, fs.readFileSync(path.join(root, relative), 'utf8')]) {
    const row = mapping(source, [expense])[0];
    assert.equal(row.petugas, 'Owner operator');
    assert.equal(row.nominal, 71000);
    assert.equal(row.id, 'e-expense-one');
    assert.equal(mapping(source, [{ ...expense, recorded_by: undefined }])[0].petugas, 'Tidak diketahui');
    const diagnostics = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true }).diagnostics ?? [];
    assert.equal(diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  }
  console.log('PASS: actual expense actor uses recorded_by; missing actor stays unknown; amount/identity preserved; changed TSX syntax valid.');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
