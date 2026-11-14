// Regresi urutan dropdown Check-in (tipe kamar & paket). Presentasi saja.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');

function load(file) {
  const context = { exports: {}, require() { throw Error('Unexpected dependency'); } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  return context.exports;
}

const helpers = load('src/lib/urutan-pilihan.ts');

test('Tipe kamar terurut Standard, Superior A, Superior B, Deluxe; tipe lain di belakang', () => {
  const rows = [
    { id: 'd', name: 'Deluxe' },
    { id: 's', name: 'Standard' },
    { id: 'su', name: 'Suite' },
    { id: 'sa', name: 'Superior A' },
    { id: 'sb', name: 'Superior B' },
  ];
  const before = JSON.stringify(rows);
  assert.deepEqual(helpers.tipeKamarTerurut(rows).map(t => t.name),
    ['Standard', 'Superior A', 'Superior B', 'Deluxe', 'Suite']);
  assert.equal(JSON.stringify(rows), before, 'array sumber tidak boleh diubah');
});

test('Paket terurut 2, 4, 6, 12, 24 jam lalu Pagi, Malam, Harian, Mingguan; non-aktif tersaring', () => {
  const rows = [
    { id: 'h', name: 'Paket Harian', active: true },
    { id: 'm', name: 'Paket 24 Jam', active: true },
    { id: 'x', name: 'Paket Lama', active: false },
    { id: 'a', name: 'Paket 2 Jam', active: true },
    { id: 'p', name: 'Paket Pagi', active: true },
    { id: 'n', name: 'Paket Malam', active: true },
    { id: 'w', name: 'Paket Mingguan', active: true },
    { id: 'b', name: 'Paket 4 Jam', active: true },
    { id: 'c', name: 'Paket 6 Jam', active: true },
    { id: 't', name: 'Paket 12 Jam', active: true },
  ];
  const before = JSON.stringify(rows);
  assert.deepEqual(helpers.paketTerurut(rows).map(p => p.name),
    ['Paket 2 Jam', 'Paket 4 Jam', 'Paket 6 Jam', 'Paket 12 Jam', 'Paket 24 Jam',
     'Paket Pagi', 'Paket Malam', 'Paket Harian', 'Paket Mingguan']);
  assert.equal(JSON.stringify(rows), before, 'array sumber tidak boleh diubah');
});
