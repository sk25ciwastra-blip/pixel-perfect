import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/routes/pengaturan-template-whatsapp.tsx', 'utf8');
const selector = source.split('const kinds:')[1]?.split('const initialApprovedDraft:')[0] ?? '';

describe('B25 Owner WhatsApp template settings', () => {
  it('shows exactly four official selectable templates; historical payment kind is not a fifth tab', () => {
    const keys = [...selector.matchAll(/key: '([A-Z0-9_]+)'/g)].map(match => match[1]);
    expect(keys).toEqual([
      'PENAWARAN_RESERVASI',
      'KONFIRMASI_BOOKING',
      'PENGINGAT_BOOKING_30_MENIT',
      'PENGINGAT_WAKTU_HABIS',
    ]);
    expect(selector).not.toContain('KONFIRMASI_PEMBAYARAN');
    expect(source).toContain('KONFIRMASI_PEMBAYARAN: OWNER_APPROVED_PAYMENT_CONFIRMATION');
  });

  it('keeps Owner-only RLS reads, audited version saves and separate reminder RPC intact', () => {
    expect(source).toContain("posisiKode === 'owner' && !training.is_training");
    expect(source).toContain(".from('whatsapp_template_versions')");
    expect(source).toContain("list.find(item => item.status === 'ACTIVE')?.body ?? initialApprovedDraft[selectedKind]");
    expect(source).toContain("reminderKind ? 'owner_save_whatsapp_reminder_template' : 'owner_save_whatsapp_template'");
    expect(source).not.toContain('.delete(');
    expect(source).not.toContain('DROP TABLE');
  });

  it('communicates active version, pending state and reload failure without false empty history', () => {
    expect(source).toContain('AKTIF · Versi ${active.revision}');
    expect(source).toContain('BELUM AKTIF');
    expect(source).toContain('Belum terverifikasi');
    expect(source).toContain('Riwayat belum dapat diverifikasi');
    expect(source).toContain('Template berhasil disimpan, tetapi daftar versi belum dapat dimuat ulang');
    expect(source).toContain('if (kind === item.key) return');
  });

  it('retains validation and manual dispatch, without touching customer template texts', () => {
    expect(source).toContain('validateWhatsAppTemplate(kind, body)');
    expect(source).toContain('disabled={!backendReady || busy || unchanged || validation.length > 0}');
    expect(source).toContain('Tidak ada pengiriman otomatis.');
    expect(source).toContain('Mengubah template tidak mengirim WhatsApp atau membuat Booking/pembayaran.');
  });
});
