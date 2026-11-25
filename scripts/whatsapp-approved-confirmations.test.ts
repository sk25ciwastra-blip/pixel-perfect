import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { OWNER_APPROVED_BOOKING_CONFIRMATION, OWNER_APPROVED_PAYMENT_CONFIRMATION } from '../src/lib/whatsapp-template-confirmations-approved';
import { validateWhatsAppTemplate, renderWhatsAppTemplate } from '../src/lib/whatsapp-template-core';

describe('Poin 4 Owner-approved Booking / Payment confirmations', () => {
  it('allows only declared Booking confirmation variables', () => {
    expect(validateWhatsAppTemplate('KONFIRMASI_BOOKING', OWNER_APPROVED_BOOKING_CONFIRMATION)).toEqual([]);
  });
  it('allows only declared Payment confirmation variables', () => {
    expect(validateWhatsAppTemplate('KONFIRMASI_PEMBAYARAN', OWNER_APPROVED_PAYMENT_CONFIRMATION)).toEqual([]);
  });
  it('keeps exactly approved Reservation wording and dynamic amounts', () => {
    const m = renderWhatsAppTemplate('KONFIRMASI_BOOKING', OWNER_APPROVED_BOOKING_CONFIRMATION, {
      NAMA_TAMU: 'Saipul', NOMOR_TRANSAKSI: 'BTRDTRX-000099',
      TIPE_KAMAR: 'Deluxe', NOMOR_KAMAR: '05', PAKET: '2 Jam',
      CHECKIN_WIB: 'Rabu, 25 Nov 2026 • 10.10 WIB', CHECKOUT_WIB: 'Rabu, 25 Nov 2026 • 12.10 WIB',
      JUMLAH_TAMU: '2', TOTAL_TAGIHAN: 'Rp90.000', SISA_TAGIHAN: 'Rp45.000',
      STATUS_PEMBAYARAN: 'PARTIALLY PAID',
    });
    expect(m).toContain('KONFIRMASI RESERVASI');
    expect(m).toContain('No. Transaksi : BTRDTRX-000099');
    expect(m).toContain('Sisa Tagihan : Rp45.000');
    expect(m).not.toContain('[NAMA_TAMU]');
    expect(OWNER_APPROVED_BOOKING_CONFIRMATION).not.toContain('DP_DITERIMA');
  });
  it('uses net paid (refund-aware), not invented method or date', () => {
    const m = renderWhatsAppTemplate('KONFIRMASI_PEMBAYARAN', OWNER_APPROVED_PAYMENT_CONFIRMATION, {
      NAMA_TAMU: 'Saipul', NOMOR_TRANSAKSI: 'BTRDTRX-000099',
      TOTAL_TAGIHAN: 'Rp90.000', TOTAL_DIBAYAR_BERSIH: 'Rp40.000',
      SISA_TAGIHAN: 'Rp50.000', STATUS_PEMBAYARAN: 'PARTIALLY PAID',
    });
    expect(m).toContain('Total Pembayaran Bersih : Rp40.000');
    expect(m).toContain('Sisa Tagihan : Rp50.000');
    expect(m).toContain('Your Comfort, Our Priority. ✨');
    expect(m).not.toContain('[TOTAL_DIBAYAR_BERSIH]');
  });
  it('prefills only if ACTIVE is missing; preserves Owner identity and explicit audited save', () => {
    const ui = readFileSync('src/routes/pengaturan-template-whatsapp.tsx', 'utf8');
    expect(ui).toContain("list.find(item => item.status === 'ACTIVE')?.body ?? initialApprovedDraft[selectedKind]");
    expect(ui).toContain("PENAWARAN_RESERVASI: OWNER_APPROVED_QUOTE_TEMPLATE");
    expect(ui).toContain("KONFIRMASI_BOOKING: OWNER_APPROVED_BOOKING_CONFIRMATION");
    expect(ui).toContain("KONFIRMASI_PEMBAYARAN: OWNER_APPROVED_PAYMENT_CONFIRMATION");
    expect(ui).toContain("const draftSuggestion = backendReady && !active && Boolean(initialApprovedDraft[kind]);");
    expect(ui).toContain("supabase.rpc('owner_save_whatsapp_template'");
    expect(ui).toContain('disabled={!backendReady || busy || unchanged || validation.length > 0}');
  });
});
