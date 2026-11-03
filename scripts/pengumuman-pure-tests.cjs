const assert = require('node:assert/strict');
(async () => {
  const { ROTATION_MS, TRANSITION_MS, urutPengumuman, indeksBerikut, bolehBerputar } = await import('../src/lib/pengumuman-rotasi.mjs');
  assert.equal(ROTATION_MS, 60000);
  assert.equal(TRANSITION_MS, 450);
  const rows = [{id:'c',created_at:'2026-10-23'}, {id:'b',created_at:'2026-10-22'}, {id:'a',created_at:'2026-10-22'}, {id:'d',created_at:'2026-10-24'}];
  assert.deepEqual(urutPengumuman(rows).map(r => r.id), ['a','b','c','d']);
  assert.equal(urutPengumuman(rows).length, 4); // no two-announcement cap
  assert.equal(indeksBerikut(3, 4), 0);
  assert.equal(indeksBerikut(0, 4, -1), 3);
  assert.equal(indeksBerikut(0, 0), 0);
  assert.equal(bolehBerputar(1, false), false);
  assert.equal(bolehBerputar(4, true), false);
  assert.equal(bolehBerputar(4, false), true);
  console.log('pengumuman-pure-tests: PASS');
})().catch(e => { console.error(e); process.exit(1); });