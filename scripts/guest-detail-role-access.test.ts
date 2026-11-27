// Pure Guest Detail role matrix; no login, no network, no operational data.
import assert from 'node:assert/strict';
import { guestDetailPermissions } from '../src/lib/guest-detail-access';
import type { PosisiAkses } from '../src/lib/peran';

type Expected = { canView: boolean; canWrite: boolean; canContact: boolean; transactionMode: 'full' | 'read-only' };
let count=0;
function check(label: string, position: PosisiAkses, signedIn:boolean, expected:Expected) {
  assert.deepEqual(guestDetailPermissions(position,signedIn), expected,label);
  count++;
  console.log('PASS',label);
}
for(const position of ['owner','receptionist','supervisor'] as PosisiAkses[]) {
  check(`${position} may read and edit guests`,position,true,{
    canView:true,canWrite:true,canContact:true,transactionMode:'full',
  });
}
check('Inspector can see records but cannot edit/contact/print', 'inspector',true,{
  canView:true,canWrite:false,canContact:false,transactionMode:'read-only',
});
for(const position of ['housekeeping','investor',null] as PosisiAkses[]){
  check(`${position ?? 'missing role'} denied Guest route`,position,true,{
    canView:false,canWrite:false,canContact:false,transactionMode:'full',
  });
}
for(const position of ['owner','receptionist','supervisor','inspector','housekeeping','investor',null] as PosisiAkses[]){
  const actual=guestDetailPermissions(position,false);
  assert.equal(actual.canView,false,`No signed-out read for ${position}`);
  assert.equal(actual.canWrite,false,`No signed-out write for ${position}`);
  assert.equal(actual.canContact,false,`No signed-out contact for ${position}`);
  count++;
  console.log('PASS signed out',position);
}
console.log(`PASS ${count}/${count} Guest Detail role capabilities`);
