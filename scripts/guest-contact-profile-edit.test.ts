// Synthetic-only regression: editing a contact must never rewrite untouched
// profile fields or manufacture extra phone/email audit changes.
import assert from 'node:assert/strict';
import { changedGuestProfileFields, untouchedGuestEdit, type GuestEditTouched } from '../src/lib/guest-profile-edit';
import { formatGuestWhatsAppInput, guestWhatsAppCanonical, isValidGuestWhatsApp } from '../src/lib/guest-entry-format';

const original = {
  full_name: 'YUDI',
  address: 'Jl. TENGAH', // intentionally legacy casing
  phone: '6281234567890', // intentionally legacy +62 without '+'
  email: null,
};
const normalized = {
  full_name: 'YUDI',
  address: 'Jl. Tengah',
  phone: '+6281234567890',
  email: null,
};
let count = 0;
function check(name: string, received: unknown, expected: unknown) {
  assert.deepEqual(received,expected,name);
  console.log('PASS',name);
  count++;
}
function touched(...fields: Array<keyof GuestEditTouched>): GuestEditTouched {
  const flags={...untouchedGuestEdit};
  for (const field of fields) flags[field]=true;
  return flags;
}
check('Opening edit without touching fields has no database changes',
  changedGuestProfileFields(original,normalized,touched()),{});
check('Editing only Email does not silently change historic phone/address format',
  changedGuestProfileFields(original,{...normalized,email:'owner@example.com'},touched('email')),
  {email:'owner@example.com'});
check('Editing only phone does not reformat name, address or email',
  changedGuestProfileFields(original,{...normalized,phone:'0812999999999'},touched('phone')),
  {phone:'0812999999999'});
check('Explicit formatting of WhatsApp is auditable if the operator edits that field',
  changedGuestProfileFields(original,normalized,touched('phone')),
  {phone:'+6281234567890'});
check('Explicit address change records only address',
  changedGuestProfileFields(original,{...normalized,address:'Bandung'},touched('address')),
  {address:'Bandung'});
check('Changing phone and email records exactly those fields',
  changedGuestProfileFields(original,{...normalized,phone:'085659808499',email:'mail@example.com'},touched('phone','email')),
  {phone:'085659808499',email:'mail@example.com'});
check('Reverting a modified value to its original does not make a false update',
  changedGuestProfileFields(original,{...normalized,phone:original.phone},touched('phone')),
  {});
check('Clearing an existing email writes null, not an empty string',
  changedGuestProfileFields({...original,email:'abc@example.com'},{...normalized,email:null},touched('email')),
  {email:null});
check('Keeping a null email empty is a no-op',
  changedGuestProfileFields(original,{...normalized,email:null},touched('email')),
  {});
check('Pasted spaced WhatsApp number normalizes as approved',
  formatGuestWhatsAppInput('+62 856-5980-8499'),'+6285659808499');
check('Pasted 08 WhatsApp number preserves the prefix',
  formatGuestWhatsAppInput('0856 5980 8499'),'085659808499');
check('WhatsApp 08 and +62 refer to the same contact',
  guestWhatsAppCanonical('085659808499'),guestWhatsAppCanonical('+6285659808499'));
check('Malformed WhatsApp cannot pass validation',
  isValidGuestWhatsApp('0856ABC8499'),false);
console.log(`PASS ${count}/${count} phone/email edits without LIVE data mutation`);
