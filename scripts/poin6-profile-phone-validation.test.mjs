import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync('src/routes/pengaturan-profil-homestay.tsx','utf8');
test('Contact format regex matches SQL with optional plus, not escaped backslash',()=>{
  assert.match(source,/const validContact = \(value: string\) => value === '' \|\| \/\^\[\+\]\?\[0-9 \(\)-\]\{6,30\}\$\//);
  const good=/^[+]?[0-9 ()-]{6,30}$/;
  for (const value of ['0811669805','+62811669805','0811 669 805','(022) 123456']) assert.equal(good.test(value),true,value);
  for (const value of ['abc','0811\\669805','081','']) assert.equal(good.test(value),false,value);
});
