// Offline model checks; no database writes or real guest information.
import assert from 'node:assert/strict';
import {
  guestVisitStatus, guestVisitOnly, guestAverageGroupSize, guestNoteType,
  guestHistoryLabels, guestNoteCategories,
} from '../src/lib/guest-detail-derived';

const rows = [
  {status:'cancelled',guest_count:2,room_id:'A',package_id:'p'},
  {status:'booking',guest_count:4,room_id:'B',package_id:'q'},
  {status:'check_out',guest_count:2,room_id:'C',package_id:'r'},
  {status:'check_in',guest_count:3,room_id:'C',package_id:'r'},
];
let n=0;
function check(name:string, actual:unknown, expected:unknown) {
  assert.deepEqual(actual,expected,name); n++;
  console.log('PASS',name);
}
check('new guest status comes from records',guestVisitStatus([]),'Belum ada kunjungan');
check('cancelled alone does not imply visit',guestVisitStatus(rows.slice(0,1)),'Belum ada kunjungan');
check('pending booking status real',guestVisitStatus(rows.slice(0,2)),'Ada booking');
check('completed visit status real',guestVisitStatus(rows.slice(0,3)),'Pernah menginap');
check('active check-in status higher priority',guestVisitStatus(rows),'Sedang menginap');
check('favorites ignore cancellations and future bookings',guestVisitOnly(rows).map(x=>x.room_id),['C','C']);
check('average group size based only on actual visits',guestAverageGroupSize(rows),3);
check('empty average stays unknown',guestAverageGroupSize(rows.slice(0,2)),null);
check('legacy notes default Umum',guestNoteType({}),'umum');
check('typed Perhatian note recognised',guestNoteType({note_type:'perhatian'}),'perhatian');
check('invalid category does not masquerade as preference',guestNoteType({note_type:'unknown'}),'umum');
check('all categories present',guestNoteCategories.map(n=>n.id),['umum','preferensi','perhatian','lainnya']);
check('history field labels include name address phone email',
 Object.keys(guestHistoryLabels).sort(),['address','email','full_name','phone'].sort());
console.log(`PASS ${n}/${n} guest detail derived scenarios (synthetic)`);
