// UI-26-02 tahap 10 — pure readback checks for Profile Homestay.
// Synthetic values only. No Owner login, Supabase, stored contacts, or mutations.
import assert from 'node:assert/strict';
import { matchesHomestayProfileReadback, type HomestayProfileValues } from '../src/lib/homestay-profile-readback';

const requested: HomestayProfileValues = {
  business_name: 'Homestay Demo QA',
  address: 'Alamat Demo QA',
  phone: '022123456',
  whatsapp: '08123456789',
};
let passed = 0;
function check(name: string, data: Partial<HomestayProfileValues> | null | undefined, expected: boolean) {
  assert.equal(matchesHomestayProfileReadback(requested, data), expected, name);
  passed++;
  console.log('PASS', name);
}

check('all four values match', { ...requested }, true);
check('business name differs', { ...requested, business_name: 'Nama lama' }, false);
check('address differs', { ...requested, address: 'Alamat lama' }, false);
check('telephone differs', { ...requested, phone: '022000000' }, false);
check('WhatsApp differs', { ...requested, whatsapp: '0812000000' }, false);
check('missing profile row', null, false);
check('undefined readback', undefined, false);
check('missing field', { ...requested, whatsapp: undefined }, false);
check('unverified whitespace differences', { ...requested, business_name: ' Homestay Demo QA' }, false);
check('optional contacts are blank in both request and readback',
  { ...requested, phone: '', whatsapp: '' },
  matchesHomestayProfileReadback({ ...requested, phone: '', whatsapp: '' }, { ...requested, phone: '', whatsapp: '' }),
);
assert.equal(matchesHomestayProfileReadback({ ...requested, phone: '', whatsapp: '' }, { ...requested, phone: '', whatsapp: '' }), true);
console.log(`PASS ${passed}/${passed} Profile Homestay readback scenarios (synthetic only)`);
