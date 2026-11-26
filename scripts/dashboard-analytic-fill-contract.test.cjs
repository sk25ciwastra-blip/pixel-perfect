// Baturaden 25 Homestay — display-only source regression.
// Never connects to data, backend, storage or browsers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'src/routes/index.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/components/dashboard-panel.css'), 'utf8');

function test(name, condition) {
  assert.ok(condition, name);
  console.log('PASS:', name);
}

test('three analytics use one stretch grid', dashboard.includes('db-analytic-grid mt-5 grid'));
for (const name of ['judul-komposisi', 'judul-grafik', 'judul-target']) {
  test(name + ' card stretches vertically',
    new RegExp('db-analytic-panel[^\\n]*aria-labelledby="' + name + '"').test(dashboard));
}
test('donut and target content both take remaining height',
  dashboard.split('db-analytic-content mt-4 flex min-w-0 flex-1').length - 1 === 2);
test('both rings size responsively instead of fixed size-32',
  dashboard.split('db-analytic-ring relative shrink-0').length - 1 === 2);
test('revenue plot body takes remaining height',
  dashboard.includes('db-income-chart mt-4 grid min-w-0 flex-1'));
test('revenue axis and bar plot no longer have hard-coded h-28',
  dashboard.includes('db-income-y-axis relative') &&
  dashboard.includes('db-income-bars relative') &&
  !dashboard.includes('relative flex h-28 items-end'));
test('CSS supplies elastic plot height',
  css.includes('.db-income-bars {') &&
  css.includes('flex: 1 1 auto;') &&
  css.includes('.db-analytic-ring {') &&
  css.includes('aspect-ratio: 1 / 1;'));
test('responsive layout preserves narrow mobile displays',
  css.includes('@media (max-width: 420px)'));
test('chart modes and monetary data sources are unchanged',
  dashboard.includes('skalaAdaptif(skalaGrafik[modeGrafik]') &&
  dashboard.includes('totalPemasukan={totalPemasukanHariIni}') &&
  dashboard.includes('realisasi={omzetBulanIni}') &&
  dashboard.includes('window.localStorage.setItem(KUNCI_TARGET, String(nilai))'));
