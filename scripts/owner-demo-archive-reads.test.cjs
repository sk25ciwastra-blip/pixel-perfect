const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const read = file => fs.readFileSync(file, 'utf8');
function load(file, dependencies = {}) {
  const exports = {};
  const { outputText } = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  vm.runInNewContext(outputText, { exports, require: name => dependencies[name] });
  return exports;
}

async function main() {
  const demo = load('src/lib/demo-archive.ts');
  const history = Array.from({ length: 22 }, (_, i) => ({
    transaction_number: `BTRDTRX-${String(100001 + i)}`,
    created_at: i === 0 ? '2000-01-01T12:00:00Z' : '2025-01-01T12:00:00Z',
    demo_archived_at: i === 0 ? '2026-01-01T12:00:00Z' : null,
  }));
  const seen = [];
  const supabase = { from() {
    let visible, pattern, firstDate, lastDate, ascending = false, from = 0, to = Infinity;
    const query = {
      select: () => query,
      is(column, value) { assert.equal(column, 'demo_archived_at'); assert.equal(value, null); visible = true; return query; },
      or: () => query,
      ilike(_column, term) { pattern = term.replaceAll('%', '').toUpperCase(); return query; },
      gte(_column, value) { firstDate = Date.parse(value); return query; },
      lt(_column, value) { lastDate = Date.parse(value); return query; },
      order(column, order) { if (column === 'created_at') ascending = order.ascending; return query; },
      limit(n) { to = n - 1; return query; },
      range(start, end) { from = start; to = end; return query; },
      then(resolve) {
        seen.push({ visible, from });
        const rows = history.filter(row => (!visible || demo.transaksiBelumDiarsipkan(row))
          && (!firstDate || Date.parse(row.created_at) >= firstDate)
          && (!lastDate || Date.parse(row.created_at) < lastDate)
          && (!pattern || row.transaction_number.includes(pattern)))
          .sort((a, b) => (ascending ? 1 : -1) * a.created_at.localeCompare(b.created_at));
        resolve(from > 0 && from >= rows.length
          ? { data: null, count: null, error: { code: 'PGRST103', message: 'Range not satisfiable' } }
          : { data: rows.slice(from, to + 1), count: rows.length, error: null });
      },
    };
    return query;
  } };
  const { transaksiQuery, tahunTransaksiQuery } = load('src/lib/transaksi-query.ts', {
    '@tanstack/react-query': { queryOptions: value => value },
    '@/integrations/supabase/client': { supabase },
    './demo-archive': demo,
    './transaksi-filter': load('src/lib/transaksi-filter.ts'),
  });
  const page = (halaman, cari = '') => transaksiQuery({ halaman, bulan: 0, tahun: 2025, cari }).queryFn();
  assert.equal((await page(2)).total, 21);
  history[21].demo_archived_at = '2026-01-01T12:00:00Z';
  const after = await page(2);
  assert.equal(after.halaman, 1);
  assert.equal(after.rows.length, 20);
  assert.equal(after.total, 20);
  assert.ok(after.rows.every(demo.transaksiBelumDiarsipkan));
  assert.deepEqual(Array.from(await tahunTransaksiQuery.queryFn()).slice(-1), [2025]);
  assert.equal((await page(1, '100001x')).total, 0);
  assert.equal((await page(1, 'BTRDTRX-100001')).total, 0);
  assert.ok(seen.every(row => row.visible));
  const fallback = [];
  await demo.bacaTransaksiOperasional(async filtered => {
    fallback.push(filtered);
    return { error: filtered ? { code: '42703', message: 'missing demo_archived_at' } : null };
  });
  assert.deepEqual(fallback, [true, false]);
  const denied = { error: { code: '42501', message: 'denied' } };
  assert.equal(await demo.bacaTransaksiOperasional(async filtered => { assert.equal(filtered, true); return denied; }), denied);
  console.log('PASS operation query filters before count, ranges, search and years; archive of last item recovers out-of-range page');

  // Verify the chosen presentation policy is wired to each read surface.
  assert.match(read('src/routes/booking.tsx'), /transactions = useTransaksiOperasional\(\)/);
  assert.match(read('src/routes/index.tsx'), /transactions = useTransaksiOperasional\(\)/);
  assert.match(read('src/routes/index.tsx'), /const trx = transaksi\.find[\s\S]*?if \(!trx\) return \[\]/);
  assert.match(read('src/routes/keuangan.tsx'), /transactions = useTable\('transactions'\)/);
  assert.match(read('src/routes/keuangan.tsx'), /return trx \? nomorDenganArsip\(trx\)/);
  assert.match(read('src/routes/laporan.tsx'), /trxPeriode = transactions\.rows\.filter/);
  assert.match(read('src/routes/laporan.tsx'), /penerimaan = bayarPeriode\.reduce/);
  assert.equal(demo.nomorDenganArsip(history[0]), 'BTRDTRX-100001 · Arsip DEMO');
  const { buatCsvLaporan } = load('src/lib/laporan-export.ts');
  const csv = buatCsvLaporan({ awal: '2025-01-01', akhir: '2025-01-01', penerimaan: 100000,
    pengeluaran: 20000, jumlahTransaksi: 2, jumlahArsipDemo: 1, metode: { Cash: 100000 },
    rekap: [{ tgl: '2025-01-01', transaksi: 2, arsipDemo: 1, masuk: 100000, keluar: 20000 }],
  });
  assert.match(csv, /"Di antaranya Arsip DEMO","1"/);
  assert.match(csv, /"2025-01-01","2","100000","20000","80000","1"/);
  console.log('PASS operation surface wiring, finance trace label, historical count and receipt totals in report export');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
