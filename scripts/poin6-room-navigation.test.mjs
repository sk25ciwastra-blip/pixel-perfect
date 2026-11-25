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

test('Integrated Poin6 links profile and payment cards only to existing guarded pages', () => {
  assert.match(settings, /label: "Profil Homestay"[^\n]*ke: "\/pengaturan-profil-homestay"/);
  assert.match(settings, /label: "Metode Pembayaran"[^\n]*ke: "\/pengaturan-metode-pembayaran"/);
  const profile = readFileSync('src/routes/pengaturan-profil-homestay.tsx', 'utf8');
  const methods = readFileSync('src/routes/pengaturan-metode-pembayaran.tsx', 'utf8');
  assert.match(profile, /if \(!owner\)/);
  assert.match(profile, /b25_read_homestay_profile/);
  assert.match(methods, /if \(!owner\)/);
  assert.match(methods, /featureFlags\.combinedPayment/);
});
