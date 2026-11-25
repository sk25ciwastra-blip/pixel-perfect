import { describe, expect, it } from 'bun:test';
import { OWNER_APPROVED_QUOTE_TEMPLATE } from '../src/lib/whatsapp-template-approved';
import { renderWhatsAppTemplate, validateWhatsAppTemplate } from '../src/lib/whatsapp-template-core';
import { readFileSync } from 'node:fs';

describe('Poin4 Owner-approved initial quote', () => {
  it('passes the exact existing SQL allowlist/token contract', () => {
    expect(validateWhatsAppTemplate('PENAWARAN_RESERVASI', OWNER_APPROVED_QUOTE_TEMPLATE)).toEqual([]);
  });
  it('is a real dynamic quote, not hardcoded guest, money or DP policy', () => {
    const input = {
      NAMA_TAMU: 'Saipul', TIPE_KAMAR: 'Deluxe', NOMOR_KAMAR: '05', PAKET: '2 Jam',
      CHECKIN_WIB: 'Rabu, 25 Nov 2026 • 10.10 WIB',
      CHECKOUT_WIB: 'Rabu, 25 Nov 2026 • 12.10 WIB',
      JUMLAH_TAMU: '2', HARGA_KAMAR: 'Rp90.000', BIAYA_TAMBAHAN: 'Rp0',
      TOTAL_TAGIHAN: 'Rp90.000', DP_MINIMUM: 'Rp45.000',
    };
    const message = renderWhatsAppTemplate('PENAWARAN_RESERVASI', OWNER_APPROVED_QUOTE_TEMPLATE, input);
    expect(message).toContain('Halo Kak Saipul');
    expect(message).toContain('Minimum DP : *Rp45.000*');
    expect(message).toContain('Pembayaran Lunas : *Rp90.000*');
    expect(message).toContain('Ketersediaan kamar dapat berubah sebelum Booking dikonfirmasi.');
    expect(message).not.toContain('[NAMA_TAMU]');
    expect(message).not.toContain('[DP_MINIMUM]');
    expect(OWNER_APPROVED_QUOTE_TEMPLATE).not.toContain('40%');
    expect(OWNER_APPROVED_QUOTE_TEMPLATE).not.toContain('50%');
  });
  it('only preloads for absent active quote, never overwrites an existing Owner version or auto-saves', () => {
    const source = readFileSync('src/routes/pengaturan-template-whatsapp.tsx', 'utf8');
    expect(source).toContain("list.find(item => item.status === 'ACTIVE')?.body ?? (selectedKind === 'PENAWARAN_RESERVASI' ? OWNER_APPROVED_QUOTE_TEMPLATE : '')");
    expect(source).toContain("if (!owner || !backendReady || busy || unchanged || validation.length) return;");
    expect(source).toContain("supabase.rpc('owner_save_whatsapp_template'");
    expect(source).not.toContain("useEffect(() => { void save()");
  });
});
