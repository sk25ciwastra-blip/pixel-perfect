import assert from 'node:assert/strict';
import { capitalizeLiveText } from '../src/lib/live-auto-capitalization';

const checks: Array<[string, string, 'sentence' | 'words', string]> = [
  ['First typed letter immediately uppercase', 'k', 'sentence', 'K'],
  ['Street input initial uppercase', 'kiaracondong', 'words', 'Kiaracondong'],
  ['Address preserves trailing space for next word', 'jalan ', 'words', 'Jalan '],
  ['Address capitalizes every entered word', 'jalan kiaracondong', 'words', 'Jalan Kiaracondong'],
  ['Address preserves RT/RW notation', 'rt/rw 01/02', 'words', 'RT/RW 01/02'],
  ['Sentence only capitalizes the first letter', 'sudah diterima', 'sentence', 'Sudah diterima'],
  ['No unexpected lowercase conversion', 'iPhone dan WiFi', 'sentence', 'IPhone dan WiFi'],
  ['Original text capitalization remains', 'Bandung', 'sentence', 'Bandung'],
  ['Leading spaces preserved during typing', '  bandung', 'sentence', '  Bandung'],
  ['Empty field stays empty', '', 'sentence', ''],
  ['Number-only values remain unchanged', '123456', 'sentence', '123456'],
  ['Unicode Indonesian text supports accents', 'école', 'sentence', 'École'],
];
for (const [label,input,mode,want] of checks) {
  assert.equal(capitalizeLiveText(input,mode),want,label);
  console.log('PASS',label);
}
console.log(`PASS ${checks.length}/${checks.length} pure live capitalization cases`);
