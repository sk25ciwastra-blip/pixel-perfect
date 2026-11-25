import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { validateWhatsAppTemplate, renderWhatsAppTemplate } from '../src/lib/whatsapp-template-core';
import { OWNER_REVISED_UNPAID_RESERVATION_DRAFT } from '../src/lib/whatsapp-template-reservation-draft';
import { OWNER_OVERTIME_NOTIFICATION_DRAFT } from '../src/lib/whatsapp-template-overtime-draft';

const settings = readFileSync('src/routes/pengaturan-template-whatsapp.tsx', 'utf8');
const reservationUi = readFileSync('src/components/reservation-whatsapp-message.tsx', 'utf8');

describe('Owner four WhatsApp kinds — unpaid reservation and manual overtime', () => {
  it('prepayment confirmation is only a pending request, without TRX or payment-received claims', () => {
    expect(validateWhatsAppTemplate('PENAWARAN_RESERVASI', OWNER_REVISED_UNPAID_RESERVATION_DRAFT)).toEqual([]);
    const message = renderWhatsAppTemplate('PENAWARAN_RESERVASI', OWNER_REVISED_UNPAID_RESERVATION_DRAFT, {
      NAMA_TAMU: 'Saipul', TIPE_KAMAR: 'Deluxe', NOMOR_KAMAR: '10', PAKET: '6 jam',
      CHECKIN_WIB: '26 Nov 2026 12:00 WIB', CHECKOUT_WIB: '26 Nov 2026 18:00 WIB',
      JUMLAH_TAMU: 2, HARGA_KAMAR: 'Rp200.000', BIAYA_TAMBAHAN: 'Rp0',
      TOTAL_TAGIHAN: 'Rp200.000', DP_MINIMUM: 'Rp100.000',
    });
    expect(message).toContain('KONFIRMASI RESERVASI');
    expect(message).toContain('MENUNGGU PEMBAYARAN');
    expect(message).toContain('Minimum DP (50%) : *Rp100.000*');
    expect(message).toContain('Kamar belum terkunci');
    expect(message).not.toContain('No. Transaksi');
    expect(message).not.toContain('pembayaran telah kami terima');
    expect(message).not.toContain('RESERVASI TELAH DIKONFIRMASI');
    expect(OWNER_REVISED_UNPAID_RESERVATION_DRAFT).not.toContain('[NOMOR_TRANSAKSI]');
    expect(settings).toContain("key: 'PENAWARAN_RESERVASI', title: 'Konfirmasi Reservasi'");
    expect(reservationUi).toContain('Template WhatsApp — Konfirmasi Reservasi');
    // Technical kind retained for the existing scoped ACTIVE reader.
    expect(reservationUi).toContain("_kind: 'PENAWARAN_RESERVASI'");
  });

  it('overtime is a manual notice, not an automatic invoice or charge', () => {
    expect(validateWhatsAppTemplate('PEMBERITAHUAN_OVERTIME', OWNER_OVERTIME_NOTIFICATION_DRAFT)).toEqual([]);
    const message = renderWhatsAppTemplate('PEMBERITAHUAN_OVERTIME', OWNER_OVERTIME_NOTIFICATION_DRAFT, {
      NAMA_TAMU: 'Saipul', NOMOR_TRANSAKSI: 'BTRDTRX-000123',
      NOMOR_KAMAR: '09', BATAS_CHECKOUT_WIB: '26 Nov 2026 18:00 WIB',
    });
    expect(message).toContain('Pemberitahuan Overtime'.toUpperCase());
    expect(message).toContain('Rp50.000 per jam');
    expect(message).toContain('menghubungi Receptionist');
    expect(message).not.toContain('[NAMA_TAMU]');
    expect(validateWhatsAppTemplate('PEMBERITAHUAN_OVERTIME', 'Tagihan [NOMINAL_CHARGE]')).not.toEqual([]);
    expect(settings).toContain('belum aktif di Cloud');
    expect(settings).not.toContain('autoChargeOvertime');
  });

  it('ships overtime schema changes as PENDING ONLY with audited Owner save and no finance writes', () => {
    const sql = readFileSync('supabase/pending/20261126_whatsapp_overtime_notice_kind.sql', 'utf8');
    expect(sql).toContain('PENDING ONLY. DO NOT APPLY TO CLOUD');
    expect(sql).toContain('whatsapp_template_versions_kind_check');
    expect(sql).toContain("'PEMBERITAHUAN_OVERTIME'");
    expect(sql).toContain('finance_training_current_user_is_restricted');
    expect(sql).toContain("emp.position::text='receptionist'");
    expect(sql).toContain('whatsapp_template_audit');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).not.toContain('DELETE FROM public.whatsapp_template_versions');
    expect(sql).not.toContain('INSERT INTO public.payments');
    expect(sql).not.toContain('UPDATE public.transactions');
    expect(sql).not.toContain('pg_cron');
  });

  it('keeps post-payment confirmation for compatibility without exposing a fifth tab', () => {
    const selected = settings.split('const kinds:')[1]?.split('const initialApprovedDraft:')[0] ?? '';
    expect(selected).not.toContain('KONFIRMASI_BOOKING');
    expect(selected).not.toContain('KONFIRMASI_PEMBAYARAN');
    expect(settings).toContain('KONFIRMASI_BOOKING: OWNER_APPROVED_BOOKING_CONFIRMATION');
    expect(settings).toContain('KONFIRMASI_PEMBAYARAN: OWNER_APPROVED_PAYMENT_CONFIRMATION');
    expect(settings).toContain('owner_save_whatsapp_template');
    expect(settings).toContain('owner_save_whatsapp_reminder_template');
  });
});
