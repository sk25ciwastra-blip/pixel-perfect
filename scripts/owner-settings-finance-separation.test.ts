import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
const src=(path:string)=>readFileSync(path,'utf8');
const menu=src('src/routes/pengaturan.tsx');
const dp=src('src/routes/pengaturan-keuangan.tsx');
const bank=src('src/routes/pengaturan-rekening-owner.tsx');
const payment=src('src/routes/pengaturan-metode-pembayaran.tsx');
test('Owner financial settings separate; payment settings menu intentionally removed',()=>{
 expect(menu).toMatch(/label: "Minimum DP & Komisi"[^\n]*ke: "\/pengaturan-keuangan"/);
 expect(menu).toMatch(/label: "Rekening Owner"[^\n]*ke: "\/pengaturan-rekening-owner"/);
 expect(menu).not.toContain('label: "Metode Pembayaran"');
 expect(bank).toContain("createFileRoute('/pengaturan-rekening-owner')");
 expect(payment).toContain("createFileRoute('/pengaturan-metode-pembayaran')");
});
test('Owner only, banking separate from DP RPCs',()=>{
 expect(bank).toContain("posisiKode === 'owner'");
 expect(dp).toContain("posisiKode === 'owner'");
 expect(payment).toContain("posisiKode === 'owner'");
 expect(bank).toContain("upsert_finance_bank_account");
 expect(bank).not.toContain("set_finance_settings");
 expect(dp).toContain("set_finance_settings");
 expect(dp).toContain("set_finance_commission_config");
 expect(dp).not.toContain("upsert_finance_bank_account");
});
test('legacy payment methods remain supported without exposing an unnecessary settings menu',()=>{
 for(const method of ['Cash','QRIS','Transfer'])expect(payment).toContain(method);
 expect(payment).not.toContain("upsert_finance_bank_account");
 expect(payment).not.toContain("supabase.from(");
});
