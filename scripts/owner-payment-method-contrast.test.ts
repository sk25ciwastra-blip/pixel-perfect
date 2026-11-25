import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
const source=readFileSync('src/routes/pengaturan-metode-pembayaran.tsx','utf8');
const styles=readFileSync('src/routes/pengaturan-metode-pembayaran.css','utf8');
test('payment method contrast uses scoped warm-white cards with legible foreground',()=>{
  expect(source).toContain("import './pengaturan-metode-pembayaran.css'");
  for(const name of ['pm-owner-page','pm-owner-row','pm-owner-name','pm-owner-note','pm-owner-label','pm-owner-info'])expect(source).toContain(name);
  expect(styles).toContain('background: #fffdf7');
  expect(styles).toContain('color: #25211c');
  expect(styles).toContain('color: #62584b');
  expect(styles).not.toContain('body {');
});
test('only informational controls are displayed; transaction payment logic remains unchanged',()=>{
  for(const name of ['Cash','QRIS','Transfer'])expect(source).toContain(name);
  expect(source).toContain('Belum ada backend resmi');
  expect(source).not.toContain('onChange=');
  expect(source).not.toContain("supabase.from(");
});
