// Synthetic-only regression for Detail Tamu history tabs.
// Never connects to Supabase/Lovable or changes guest/transaction data.
import assert from 'node:assert/strict';
import {
  guestHistoryDate, guestHistoryDateHeading, guestHistoryEmptyText,
  guestHistoryInAt, guestHistoryInHeading, guestHistoryLoadError,
  guestHistoryOutAt, guestHistoryOutHeading, type GuestHistoryTab,
} from '../src/lib/guest-history-view';

const example = {
  created_at: '2026-11-20T08:00:00+07:00',
  started_at: '2026-11-23T14:15:00+07:00',
  checked_out_at: '2026-11-23T16:15:00+07:00',
  scheduled_check_in: '2026-11-23T14:00:00+07:00',
  scheduled_check_out: '2026-11-23T16:00:00+07:00',
};
let tested = 0;
function verify(label:string,actual:unknown,expected:unknown){
  assert.deepEqual(actual,expected,label);
  console.log('PASS',label);
  tested++;
}
const emptyByTab: Record<GuestHistoryTab,string> = {
  kunjungan:'Belum ada riwayat kunjungan',
  transaksi:'Belum ada riwayat transaksi',
  booking:'Belum ada riwayat booking',
};
for(const tab of Object.keys(emptyByTab) as GuestHistoryTab[]) {
  verify(`Empty text for ${tab}`,guestHistoryEmptyText(tab),emptyByTab[tab]);
  verify(`Specific read error ${tab}`,guestHistoryLoadError(tab).toLowerCase().includes(tab),true);
}
verify('Kunjungan column heading',guestHistoryDateHeading('kunjungan'),'Tgl Kunjungan');
verify('Transaksi column heading',guestHistoryDateHeading('transaksi'),'Tgl Transaksi');
verify('Booking column heading names the schedule',guestHistoryDateHeading('booking'),'Jadwal Check-in');
verify('Actual check-in label',guestHistoryInHeading('kunjungan'),'Check-in');
verify('Planned check-in label',guestHistoryInHeading('booking'),'Jam Rencana CI');
verify('Planned check-out label',guestHistoryOutHeading('booking'),'Jam Rencana CO');
verify('Actual checkout label',guestHistoryOutHeading('transaksi'),'Check-out');
verify('Visit date uses actual start, not booking or creation date',guestHistoryDate('kunjungan',example),example.started_at);
verify('Transaction date uses recorded created_at',guestHistoryDate('transaksi',example),example.created_at);
verify('Booking date uses scheduled check-in',guestHistoryDate('booking',example),example.scheduled_check_in);
verify('Booking check-in time uses planned time',guestHistoryInAt('booking',example),example.scheduled_check_in);
verify('Booking check-out time uses planned time',guestHistoryOutAt('booking',example),example.scheduled_check_out);
verify('Visit check-in time uses real start',guestHistoryInAt('kunjungan',example),example.started_at);
verify('Visit checkout uses real checkout',guestHistoryOutAt('kunjungan',example),example.checked_out_at);
verify('Transaction checkout uses real checkout',guestHistoryOutAt('transaksi',example),example.checked_out_at);

const pending = { ...example, started_at:null, checked_out_at:null };
verify('Never fabricate actual visit date for not-checked-in booking',guestHistoryDate('kunjungan',pending),null);
verify('Never fabricate actual checkout from scheduled checkout',guestHistoryOutAt('transaksi',pending),null);
verify('Still display planned checkout for booking',guestHistoryOutAt('booking',pending),example.scheduled_check_out);
const walkIn = {...example,scheduled_check_in:null,scheduled_check_out:null};
verify('Walk-in has no fake booking schedule',guestHistoryDate('booking',walkIn),null);
console.log(`PASS ${tested}/${tested} Guest Detail tab-date scenarios`);
