import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const settings = readFileSync('src/routes/pengaturan.tsx', 'utf8');
const rooms = readFileSync('src/routes/tipe-kamar.tsx', 'utf8');

test('Owner Manajemen Kamar opens existing Tipe Kamar management, not a dead card', () => {
  assert.match(settings, /label: "Manajemen Kamar"[^\n]*ke: "\/tipe-kamar"/);
  assert.match(settings, /peran === "owner" \? kelompok/);
  assert.match(rooms, /function ubah\(r\?:Room\)/);
  assert.match(rooms, /supabase\.from\('rooms'\)\.update/);
  assert.match(rooms, /supabase\.from\('rooms'\)\.insert/);
  assert.match(rooms, /aria-label=\{\x60\$\{r\.active\?/);
});

test('Profile Homestay and Metode Pembayaran remain unavailable without proven write contract', () => {
  for (const title of ['Profil Homestay', 'Metode Pembayaran']) {
    const line = settings.split('\n').find(line => line.includes('label: "' + title + '"'));
    assert.ok(line, 'missing expected settings card: ' + title);
    assert.doesNotMatch(line, /ke:/, title + ' must not be linked to a nonfunctional page');
  }
});
