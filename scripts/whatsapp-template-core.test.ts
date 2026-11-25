import { describe, expect, it } from 'bun:test';
import { renderWhatsAppTemplate, validateWhatsAppTemplate } from '../src/lib/whatsapp-template-core';

const offer = '*BATURADEN 25 HOMESTAY*\\nHalo [NAMA_TAMU], total [TOTAL_TAGIHAN]. DP [DP_MINIMUM].';
const booking = 'Booking [NOMOR_TRANSAKSI] atas nama [NAMA_TAMU].';
const pay = 'Pembayaran [NOMOR_TRANSAKSI]: [STATUS_PEMBAYARAN]';

describe('Poin 4/7 WhatsApp templates (no DB or send effects)', () => {
  it('renders only validated offer fields', () => {
    expect(renderWhatsAppTemplate('PENAWARAN_RESERVASI', offer, {
      NAMA_TAMU: 'Andin', TOTAL_TAGIHAN: 'Rp400.000', DP_MINIMUM: 'Rp200.000',
    })).toContain('Halo Andin, total Rp400.000. DP Rp200.000.');
  });
  it('does not allow a fabricated official TRX in a pre-booking offer', () => {
    expect(validateWhatsAppTemplate('PENAWARAN_RESERVASI', 'Penawaran [NAMA_TAMU] TRX [NOMOR_TRANSAKSI]')).not.toEqual([]);
  });
  it('allows TRX in official confirmation but not missing values', () => {
    expect(renderWhatsAppTemplate('KONFIRMASI_BOOKING', booking, {
      NOMOR_TRANSAKSI: 'BTRDTRX-000027', NAMA_TAMU: 'Andin',
    })).toContain('BTRDTRX-000027');
    expect(() => renderWhatsAppTemplate('KONFIRMASI_BOOKING', booking, {
      NOMOR_TRANSAKSI: '', NAMA_TAMU: 'Andin',
    })).toThrow();
  });
  it('does not guess financial status and denies missing ledger data', () => {
    expect(() => renderWhatsAppTemplate('KONFIRMASI_PEMBAYARAN', pay, {
      NOMOR_TRANSAKSI: 'BTRDTRX-000027',
    })).toThrow();
  });
  it('blocks unknown/malformed tokens and unsafe control characters', () => {
    expect(validateWhatsAppTemplate('KONFIRMASI_BOOKING', 'Halo [NAMA_TAMU] [PASSWORD]')).not.toEqual([]);
    expect(validateWhatsAppTemplate('KONFIRMASI_BOOKING', 'Halo [nama_tamu]')).not.toEqual([]);
    expect(() => renderWhatsAppTemplate('KONFIRMASI_BOOKING', booking, {
      NAMA_TAMU: 'A\\nB', NOMOR_TRANSAKSI: 'BTRDTRX-000027',
    })).toThrow();
  });
  it('keeps Unicode guest names readable', () => {
    expect(renderWhatsAppTemplate('PENAWARAN_RESERVASI', 'Halo [NAMA_TAMU]', {
      NAMA_TAMU: 'Dewi 🌸',
    })).toBe('Halo Dewi 🌸');
  });
});
