import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { manualReminderEligibility, type ReminderCandidate } from '../src/lib/whatsapp-manual-reminders';
import { validateWhatsAppTemplate, renderWhatsAppTemplate } from '../src/lib/whatsapp-template-core';
import { OWNER_APPROVED_BOOKING_30_MIN_REMINDER, OWNER_APPROVED_STAY_END_REMINDER } from '../src/lib/whatsapp-template-reminders-approved';

const booking: ReminderCandidate = {
  id:'b',transaction_number:'BTRDTRX-000101',status:'booking',
  scheduled_check_in:'2026-11-26T10:00:00+07:00',ends_at:null,checked_out_at:null,
};
const stay: ReminderCandidate = {
  id:'s',transaction_number:'BTRDTRX-000102',status:'check_in',
  scheduled_check_in:null,ends_at:'2026-11-26T12:00:00+07:00',checked_out_at:null,
};
const at=(v:string)=>Date.parse(v);
describe('Owner Poin4 manual WhatsApp trigger contract',()=>{
  it('Booking alert begins exactly 30 min before official check-in and stops at check-in',()=>{
    expect(manualReminderEligibility(booking,at('2026-11-26T09:29:59.999+07:00'))).toBeNull();
    expect(manualReminderEligibility(booking,at('2026-11-26T09:30:00+07:00'))).toBe('PENGINGAT_BOOKING_30_MENIT');
    expect(manualReminderEligibility(booking,at('2026-11-26T09:59:59.999+07:00'))).toBe('PENGINGAT_BOOKING_30_MENIT');
    expect(manualReminderEligibility(booking,at('2026-11-26T10:00:00+07:00'))).toBeNull();
  });
  it('Expired stay alert starts at ends_at; 15 min is a message window only, not charging',()=>{
    expect(manualReminderEligibility(stay,at('2026-11-26T11:59:59.999+07:00'))).toBeNull();
    expect(manualReminderEligibility(stay,at('2026-11-26T12:00:00+07:00'))).toBe('PENGINGAT_WAKTU_HABIS');
    expect(manualReminderEligibility(stay,at('2026-11-26T12:14:59.999+07:00'))).toBe('PENGINGAT_WAKTU_HABIS');
    expect(manualReminderEligibility(stay,at('2026-11-26T12:15:00+07:00'))).toBeNull();
  });
  it('Missing times, cancelled/checked-out, invalid clock and converted Booking do not alert',()=>{
    expect(manualReminderEligibility({...booking,status:'cancelled'},at('2026-11-26T09:45:00+07:00'))).toBeNull();
    expect(manualReminderEligibility({...booking,status:'check_in'},at('2026-11-26T09:45:00+07:00'))).toBeNull();
    expect(manualReminderEligibility({...stay,checked_out_at:'2026-11-26T12:01:00+07:00'},at('2026-11-26T12:02:00+07:00'))).toBeNull();
    expect(manualReminderEligibility({...stay,ends_at:null},at('2026-11-26T12:02:00+07:00'))).toBeNull();
    expect(manualReminderEligibility(stay,NaN)).toBeNull();
  });
  it('Both reminder kinds use allowlisted variables; no fabricated approved copy',()=>{
    expect(validateWhatsAppTemplate('PENGINGAT_BOOKING_30_MENIT','Halo [NAMA_TAMU], check-in [CHECKIN_WIB].')).toEqual([]);
    expect(validateWhatsAppTemplate('PENGINGAT_WAKTU_HABIS','Halo [NAMA_TAMU], batas [BATAS_CHECKOUT_WIB].')).toEqual([]);
    expect(validateWhatsAppTemplate('PENGINGAT_WAKTU_HABIS','[HARGA_OVERTIME]')).not.toEqual([]);
  });
  it('UI needs active Receptionist, click, fresh reads, manual web WhatsApp; never autosends',()=>{
    const ui=readFileSync('src/components/pengingat-whatsapp-manual.tsx','utf8');
    expect(ui).toContain("posisiKode === 'receptionist' && !training.is_training");
    expect(ui).toContain("onClick={() => void send(transaction)}");
    expect(ui).toContain("manualReminderEligibility(fresh, Date.now())");
    expect(ui).toContain("'read_active_whatsapp_reminder_template'");
    expect(ui).toContain("window.open('about:blank', '_blank')");
    expect(ui).not.toContain('sendWhatsAppAutomatically');
    const sql=readFileSync('supabase/pending/20261125_whatsapp_manual_reminder_kinds.sql','utf8');
    expect(sql).toContain("emp.position::text='receptionist'");
    expect(sql).toContain('finance_training_current_user_is_restricted');
    expect(sql).toContain("DROP CONSTRAINT whatsapp_template_versions_kind_check");
    expect(sql).not.toContain('DELETE FROM public.whatsapp_template_versions');
  });
  it('both Owner-approved messages render with dynamic official transaction fields',()=>{
    expect(validateWhatsAppTemplate('PENGINGAT_BOOKING_30_MENIT',OWNER_APPROVED_BOOKING_30_MIN_REMINDER)).toEqual([]);
    expect(validateWhatsAppTemplate('PENGINGAT_WAKTU_HABIS',OWNER_APPROVED_STAY_END_REMINDER)).toEqual([]);
    const b=renderWhatsAppTemplate('PENGINGAT_BOOKING_30_MENIT', OWNER_APPROVED_BOOKING_30_MIN_REMINDER,{
      NAMA_TAMU:'Saipul',NOMOR_TRANSAKSI:'BTRDTRX-000101',TIPE_KAMAR:'Deluxe',NOMOR_KAMAR:'05',CHECKIN_WIB:'Kamis, 26 Nov 2026 • 10.00 WIB',
    });
    expect(b).toContain('dalam *30 menit lagi*');
    expect(b).toContain('No. Kamar : 05');
    expect(b).not.toContain('[NAMA_TAMU]');
    const e=renderWhatsAppTemplate('PENGINGAT_WAKTU_HABIS', OWNER_APPROVED_STAY_END_REMINDER,{
      NAMA_TAMU:'Saipul',NOMOR_TRANSAKSI:'BTRDTRX-000102',NOMOR_KAMAR:'05',BATAS_CHECKOUT_WIB:'Kamis, 26 Nov 2026 • 12.00 WIB',
    });
    expect(e).toContain('waktu toleransi 15 menit');
    expect(e).not.toContain('Rp');
    expect(e).not.toContain('[BATAS_CHECKOUT_WIB]');
  });
  it('Owner editor drafts both reminders only where ACTIVE version absent',()=>{
    const ui=readFileSync('src/routes/pengaturan-template-whatsapp.tsx','utf8');
    expect(ui).toContain("PENGINGAT_BOOKING_30_MENIT: OWNER_APPROVED_BOOKING_30_MIN_REMINDER");
    expect(ui).toContain("PENGINGAT_WAKTU_HABIS: OWNER_APPROVED_STAY_END_REMINDER");
    expect(ui).toContain("list.find(item => item.status === 'ACTIVE')?.body ?? initialApprovedDraft[selectedKind]");
    expect(ui).toContain("owner_save_whatsapp_reminder_template");
  });
});
