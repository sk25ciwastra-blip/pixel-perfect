import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { withOfferFixture } from './fixtures/issue-140-offers-pg.mjs';

await withOfferFixture(async ({ db, act, quote, list, transition, owner, reception, supervisor, hk, trainee, room, room2, pack }) => {
  const [a,b,c,d] = Array.from({length:4}, randomUUID);

  await db`insert into public.guests(full_name,phone,address) values ('Tamu Lama','081234567890','Alamat Resmi')`;
  await assert.rejects(act(hk, list), {code:'42501'});
  await assert.rejects(act('', list, 'anon'), {code:'42501'});
  await assert.rejects(act(reception, tx => tx`select * from public.reservation_offers`), {code:'42501'});
  const [draft] = await act(reception, tx => quote(tx, a));
  assert.equal(draft.result.status,'DRAFT');
  assert.equal(draft.result.minimum_dp,50001);
  assert.equal(draft.result.guest_name,'Tamu Lama');
  assert.equal(draft.result.address,'Alamat Resmi');
  const [again] = await act(reception, tx => quote(tx,a,'+6281234567890'));
  assert.equal(again.result.id,a);
  const createdConcurrently = await Promise.all([
    act(supervisor, tx => quote(tx,b,'+6281234567890')),
    act(reception, tx => quote(tx,c,'6281234567890','2099-11-28T17:00:00+07:00')),
  ]);
  assert.equal(createdConcurrently.length,2);
  const [queue] = await act(owner,list);
  assert.equal(queue.result.count,3);
  assert.ok(queue.result.rows.every(item => !('phone' in item) && !('address' in item)));
  assert.equal((await db`select id from public.guests`).length,1);
  assert.equal((await db`select id from public.transactions`).length,0);
  assert.equal((await db`select transaction_id from public.payments`).length,0);
  assert.deepEqual((await db`select status from public.reservation_offer_events where offer_id=${a}`).map(row => row.status), ['DRAFT']);
  await act(supervisor,tx => transition(tx,a,'sent'));
  await act(supervisor,tx => transition(tx,a,'sent'));
  await assert.rejects(act(reception,tx => transition(tx,a,'cancel')), {code:'42501'});
  await assert.rejects(act(trainee,tx => transition(tx,a)), {code:'42501'});
  await assert.rejects(act(reception,tx => transition(tx,a,'convert',50000)), /nominal pembayaran/);
  await assert.rejects(act(reception,tx => transition(tx,a,'convert',50001,false)), /Verifikasi sesi kas/);
  await assert.rejects(act(reception,tx => transition(tx,a,'convert',50001,true,randomUUID())), { code: '23503' });
  assert.equal((await db`select tx.id from public.transactions tx`).length,0);
  assert.equal((await db`select status from public.reservation_offers where id=${a}`)[0].status,'SENT');
  assert.equal((await db`select * from public.finance_reservation_idempotency`).length,0);
  for (const digits of ['08123','+628123','628123']) {
    const [hit] = await act(reception,tx=>tx`select * from public.search_reservation_guests('phone',${digits})`);
    assert.equal(hit.full_name,'Tamu Lama');
  }
  assert.equal((await act(supervisor, tx=>tx`select * from public.search_reservation_guests('name','MU lA')`))[0].phone,'081234567890');
  await assert.rejects(act(hk,tx=>tx`select * from public.search_reservation_guests('phone','08123')`), {code:'42501'});
  console.log('PASS canonical WA, preserved identity, draft/sent audit, role and Training enforcement, no TRX/payment for offer');

  // Adjacent official stays do not invalidate the future quote window.
  await db`insert into public.transactions(room_id,package_id,status,started_at,ends_at) values
    (${room},${pack},'check_in','2099-11-28T10:00:00+07:00','2099-11-28T12:00:00+07:00')`;
  assert.equal((await act(owner,list))[0].result.count,3);
  const results = await Promise.all([
    act(reception,tx => transition(tx,a)),
    act(supervisor,tx => transition(tx,b)),
  ]);
  assert.deepEqual(results.map(x => x[0].result.status).sort(),['CONVERTED','FAILED_UNAVAILABLE']);
  assert.equal((await db`select id from public.transactions where status='booking'`).length,1);
  assert.equal((await db`select transaction_id from public.payments`).length,1);
  assert.equal((await db`select status from public.reservation_offers where id=${c}`)[0].status,'DRAFT');
  const winner = results.map(x=>x[0].result).find(x=>x.status==='CONVERTED');
  assert.equal((await act(owner, tx=>transition(tx,winner.id)))[0].result.transaction_number,winner.transaction_number);
  assert.equal((await act(owner,list))[0].result.count,1);
  const [history] = await act(reception,tx => tx`select public.read_reservation_offers((select null)::uuid) as result`);
  assert.equal(history.result.count,1);
  const [guest] = await db`select id from public.guests`;
  const [guestHistory] = await act(reception,tx => tx`select public.read_reservation_offers(${guest.id}) as result`);
  assert.equal(guestHistory.result.failed_count,1);
  assert.equal(guestHistory.result.count,3);
  await act(owner,tx => transition(tx,c,'cancel'));
  assert.equal((await act(owner,list))[0].result.count,0);
  await assert.rejects(act(reception,tx => quote(tx,d,'081111111111','2001-11-28T15:00:00+07:00',room2)), /masa depan/);
  assert.equal((await db`select id from public.guests`).length,1);
  const occupancyDraft = randomUUID();
  await act(reception,tx => quote(tx,occupancyDraft,'081234567890','2099-11-28T15:00:00+07:00',room2));
  await db`update public.rooms set status='occupied' where id=${room2}`;
  assert.equal((await act(owner,list))[0].result.count,0);
  await db`update public.rooms set status='ready' where id=${room2}`;
  assert.equal((await act(owner,list))[0].result.count,0);
  assert.equal((await db`select status from public.reservation_offers where id=${occupancyDraft}`)[0].status,'FAILED_UNAVAILABLE');
  const [newA, newB] = Array.from({ length: 2 }, randomUUID);
  await Promise.all([
    act(reception,tx=>quote(tx,newA,'081111111111','2099-12-01T15:00:00+07:00',room)),
    act(supervisor,tx=>quote(tx,newB,'+6281111111111','2099-12-01T15:00:00+07:00',room2)),
  ]);
  assert.equal((await db`select id from public.guests where phone='6281111111111'`).length,1);
  assert.equal((await db`select distinct guest_id from public.reservation_offers where id in (${newA},${newB})`).length,1);
  console.log('PASS concurrent conversion through official create_reservation, one TRX/payment, retry, adjacent slots, hidden failure, history and stale cutoff');
});
