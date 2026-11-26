// Baturaden 25 Homestay: synthetic guest-entry format regression tests.
// No database, guest records, phone calls or WhatsApp messages are changed.
import assert from 'node:assert/strict';
import {
  formatGuestName, formatGuestAddress, formatGuestWhatsAppInput,
  guestWhatsAppCanonical, isValidGuestWhatsApp,
} from '../src/lib/guest-entry-format';

let passed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, label);
  passed++;
  console.log('PASS', label);
}
check('name becomes uppercase on save', formatGuestName('  adi   supriadi '), 'ADI SUPRIADI');
check('mixed name becomes uppercase', formatGuestName('Bu Ella'), 'BU ELLA');
check('address capitalized by word', formatGuestAddress('jl baturaden raya no 25 ciwastra'), 'Jl Baturaden Raya No 25 Ciwastra');
check('RT/RW address acronyms preserved', formatGuestAddress('jl raya rt/rw 01/02'), 'Jl Raya RT/RW 01/02');
check('address whitespace normalized', formatGuestAddress('  jalan    ciwastra  '), 'Jalan Ciwastra');
check('pasted +62 hyphens removed', formatGuestWhatsAppInput('+62 856-5980-8499'), '+6285659808499');
check('pasted +62 spaces removed', formatGuestWhatsAppInput('+62 856 5980 8499'), '+6285659808499');
check('plain +62 unchanged', formatGuestWhatsAppInput('+6285659808499'), '+6285659808499');
check('pasted local 08 spaces removed', formatGuestWhatsAppInput('0856 5980 8499'), '085659808499');
check('pasted local 08 hyphens removed', formatGuestWhatsAppInput('0856-5980-8499'), '085659808499');
check('62 without plus gains + prefix', formatGuestWhatsAppInput('6285659808499'), '+6285659808499');
check('trimmed +62 delimiters removed', formatGuestWhatsAppInput('  +62 (856) 5980.8499  '), '+6285659808499');
check('08 remains 08 on save', formatGuestWhatsAppInput('0812 3456 7890'), '081234567890');
check('letters are not silently deleted', formatGuestWhatsAppInput('0856ABC8499'), '0856ABC8499');
check('internal plus is not silently deleted', formatGuestWhatsAppInput('0856+59808499'), '0856+59808499');
check('two formats refer to one guest', guestWhatsAppCanonical('0856 5980 8499'), guestWhatsAppCanonical('+62 856-5980-8499'));
check('62 without plus and 08 match canonically', guestWhatsAppCanonical('6285659808499'), guestWhatsAppCanonical('085659808499'));
check('valid local format accepted', isValidGuestWhatsApp('0856 5980 8499'), true);
check('valid +62 format accepted', isValidGuestWhatsApp('+62 856-5980-8499'), true);
check('invalid letters rejected', isValidGuestWhatsApp('0856ABC8499'), false);
check('invalid embedded + rejected', isValidGuestWhatsApp('0856+59808499'), false);
check('invalid short phone rejected', isValidGuestWhatsApp('0856'), false);
check('foreign country prefix rejected', isValidGuestWhatsApp('+6585659808499'), false);
check('invalid prefix +620 rejected', isValidGuestWhatsApp('+62085659808499'), false);
check('no phone saved if blank', isValidGuestWhatsApp(''), false);
console.log(`PASS ${passed}/${passed} guest input formatting scenarios (offline)`);
