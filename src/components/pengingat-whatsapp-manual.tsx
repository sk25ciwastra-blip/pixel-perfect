import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { rpc } from '@/lib/data-live';
import { usePeran } from '@/lib/peran';
import { manualReminderEligibility, reminderTimeWib, type ReminderCandidate } from '@/lib/whatsapp-manual-reminders';
import { renderWhatsAppTemplate } from '@/lib/whatsapp-template-core';
import { whatsAppDraftUrl } from '@/lib/whatsapp';

type ReminderRow = ReminderCandidate & { guest_id: string; room_id: string };
type GuestBrief = { id: string; full_name: string; phone: string | null };
type RoomBrief = { id: string; room_number: string; room_type_id: string };
type RoomTypeBrief = { id: string; name: string };

export function ManualWhatsAppReminders({ transactions, guests, rooms, roomTypes, nowMs }: {
  transactions: ReminderRow[];
  guests: GuestBrief[];
  rooms: RoomBrief[];
  roomTypes: RoomTypeBrief[];
  nowMs: number;
}) {
  const { siap, masuk, posisiKode, training } = usePeran();
  const allowed = siap && masuk && posisiKode === 'receptionist' && !training.is_training;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const reminders = useMemo(
    () => allowed ? transactions.flatMap(t => {
      const kind = manualReminderEligibility(t, nowMs);
      return kind ? [{ transaction: t, kind }] : [];
    }) : [],
    [allowed, transactions, nowMs],
  );

  useEffect(() => { setError(''); }, [reminders.length]);

  if (!allowed || reminders.length === 0) return null;

  async function send(transaction: ReminderRow) {
    if (!allowed || busy) return;
    setError('');
    // Open a blank tab synchronously as a DIRECT Receptionist click.
    // No server or scheduler ever sends WhatsApp automatically.
    const tab = window.open('about:blank', '_blank');
    if (!tab) { setError('Browser memblokir tab WhatsApp. Izinkan popup dan coba lagi.'); return; }
    tab.opener = null;
    setBusy(transaction.id);
    try {
      // Never trust a stale timer/list; recheck transaction state, guest and active template.
      const { data: fresh, error: txError } = await supabase.from('transactions')
        .select('id,transaction_number,status,scheduled_check_in,ends_at,checked_out_at,guest_id,room_id')
        .eq('id', transaction.id).maybeSingle();
      if (txError || !fresh) throw new Error('Transaksi terbaru gagal diperiksa.');
      const kind = manualReminderEligibility(fresh, Date.now());
      if (!kind || kind !== manualReminderEligibility(transaction, Date.now())) {
        throw new Error('Jadwal atau status transaksi sudah berubah. Pengingat dibatalkan.');
      }
      const { data: guest, error: guestError } = await supabase.from('guests')
        .select('id,full_name,phone').eq('id', fresh.guest_id).maybeSingle();
      if (guestError || !guest || !guest.phone || !guest.full_name) {
        throw new Error('Nomor WhatsApp atau identitas tamu belum tersedia.');
      }
      const { data: templates, error: templateError } = await rpc(
        'read_active_whatsapp_reminder_template', { _kind: kind },
      );
      const active = templates?.[0];
      if (templateError || !active?.body) {
        throw new Error('Template pengingat belum diaktifkan Owner atau akses ditolak.');
      }
      const room = rooms.find(x => x.id === fresh.room_id);
      const roomType = roomTypes.find(x => x.id === room?.room_type_id);
      if (!room?.room_number) throw new Error('Nomor kamar belum dapat diverifikasi.');
      const values = {
        NAMA_TAMU: guest.full_name,
        NOMOR_TRANSAKSI: fresh.transaction_number,
        NOMOR_KAMAR: room.room_number,
        TIPE_KAMAR: roomType?.name ?? null,
        CHECKIN_WIB: fresh.scheduled_check_in ? reminderTimeWib(fresh.scheduled_check_in) : null,
        BATAS_CHECKOUT_WIB: fresh.ends_at ? reminderTimeWib(fresh.ends_at) : null,
      };
      const message = renderWhatsAppTemplate(kind, active.body, values);
      if (manualReminderEligibility(fresh, Date.now()) !== kind) {
        throw new Error('Jendela waktu pengingat sudah berakhir. Tidak ada pesan disiapkan.');
      }
      const url = whatsAppDraftUrl(guest.phone, message);
      if (!url) throw new Error('Nomor WhatsApp tamu tidak valid.');
      tab.location.replace(url);
    } catch (failure) {
      tab.close();
      setError(failure instanceof Error ? failure.message : 'Pengingat gagal disiapkan.');
    } finally {
      setBusy(null);
    }
  }

  return <section aria-label="Pengingat WhatsApp manual" className="mb-4 rounded-xl border border-gold/30 bg-[#F7F6F3] p-4 text-[oklch(0.22_0.02_75)]">
    <h2 className="font-semibold">Pengingat WhatsApp · Tindakan Receptionist</h2>
    <p className="mb-3 text-xs">Pengingat muncul sesuai waktu resmi. Tekan Kirim WhatsApp untuk membuka draf pesan; petugas tetap mengirimnya secara manual di WhatsApp. Tidak ada charge overtime otomatis.</p>
    <div className="space-y-2">
      {reminders.map(({transaction, kind}) => {
        const guest = guests.find(g => g.id === transaction.guest_id);
        return <div key={transaction.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold/20 bg-white p-3">
          <div className="text-sm">
            <strong>{kind === 'PENGINGAT_BOOKING_30_MENIT' ? 'Booking 30 menit lagi' : 'Waktu menginap habis · toleransi 15 menit'}</strong>
            <p>{transaction.transaction_number} · {guest?.full_name ?? 'Tamu'}</p>
          </div>
          <Button type="button" size="sm" disabled={busy !== null || !guest?.phone}
            onClick={() => void send(transaction)}>
            {busy === transaction.id ? 'Memverifikasi…' : 'Kirim WhatsApp'}
          </Button>
        </div>;
      })}
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </section>;
}
