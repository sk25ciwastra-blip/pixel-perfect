import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { choosePaymentMethods, amountAfterPaymentSwitch } from '../src/lib/payment-method-choice';
import { buatCsvLaporan } from '../src/lib/laporan-export';

describe('P0 payment method switch', () => {
  test('replaces QRIS with Cash when combined payments OFF', () => {
    expect(choosePaymentMethods(['QRIS'] as const,'Cash',false)).toEqual(['Cash']);
    expect(amountAfterPaymentSwitch({ QRIS: '42000' },['QRIS'],'Cash',false)).toEqual({ Cash: '42000' });
  });
  test('keeps exactly one method when selecting the same single option', () => {
    expect(choosePaymentMethods(['QRIS'],'QRIS',false)).toEqual(['QRIS']);
  });
  test('still allows two methods only when gate ON', () => {
    expect(choosePaymentMethods(['QRIS'],'Cash',true)).toEqual(['QRIS','Cash']);
    expect(choosePaymentMethods(['QRIS','Cash'],'Transfer',true)).toEqual(['QRIS','Cash']);
    expect(choosePaymentMethods(['QRIS','Cash'],'Cash',true)).toEqual(['QRIS']);
  });
  test('both live-form source paths share the same switching algorithm', () => {
    for (const path of ['src/routes/booking.tsx','src/components/formulir-pemesanan.tsx']) {
      const code=readFileSync(path,'utf8');
      expect(code).toContain('choosePaymentMethods(');
      expect(code).toContain('amountAfterPaymentSwitch(');
    }
  });
});

describe('Owner operational controls', () => {
  test('exports a clean, UTF-8, day-filtered and CSV-safe operational report', () => {
    const csv=buatCsvLaporan({
      awal:'2026-11-21',akhir:'2026-11-21',
      penerimaan:80000,pengeluaran:10000,jumlahTransaksi:1,
      rekap:[{tgl:'2026-11-21',transaksi:1,masuk:80000,keluar:10000}],
      metode:{'=HYPERLINK("bad")':80000},
    });
    expect(csv).toContain('Baturaden 25 Homestay');
    expect(csv).toContain('"Arus Kas Bersih","70000"');
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).not.toContain('guest_phone');
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });
  test('reactivates report export without exposing private customer data', () => {
    const code=readFileSync('src/routes/laporan.tsx','utf8');
    expect(code).toContain('onClick={exportCsv}');
    expect(code).toContain('disabled={loading || Boolean(gagal)}');
  });
  test('price changes require Owner RPC with audit reason, no global package rewrite', () => {
    const code=readFileSync('src/routes/paket.tsx','utf8');
    const sql=readFileSync('supabase/pending/20261121_owner_update_room_type_prices_with_audit.sql','utf8');
    expect(code).toContain("rpc('update_package_room_type_price'");
    expect(code).toContain('_pricing_group:groupeForm');
    expect(sql).toContain("NOT public.has_role(auth.uid(), 'owner'");
    expect(sql).toContain('INSERT INTO public.activity_logs');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).not.toContain('UPDATE public.transactions');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.update_package_room_type_price');
  });
  test('employee access and activity history are readable without changing rights', () => {
    const code=readFileSync('src/routes/karyawan.tsx','utf8');
    expect(code).toContain("setTab('akses')");
    expect(code).toContain("setTab('riwayat')");
    expect(code).toContain("useTable('activity_logs',tab==='riwayat')");
    expect(code).not.toContain('Tampilan hak akses belum tersedia');
    expect(code).not.toContain('Riwayat perubahan belum tersedia');
  });
});
