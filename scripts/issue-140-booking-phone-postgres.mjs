import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { withOfferFixture } from './fixtures/issue-140-offers-pg.mjs';

await withOfferFixture(async ({ db, act, quote, transition, owner, reception, supervisor, hk, room, room2, type, pack, cash }) => {
  const ids = Array.from({ length: 4 }, () => randomUUID());
  const stored = ['081234567890', '+6282234567890', '6283234567890', '+62 842-3456-7890'];
  const alternatives = ['+6281234567890', '082234567890', '083234567890', '6284234567890'];
  for (let i = 0; i < ids.length; i++) {
    await db`insert into public.guests(id,full_name,phone,address) values(${ids[i]},'Identitas Asli',${stored[i]},'Alamat Asli')`;
  }
  const direct = (tx, { phone, key, slot, where = room, mode = 'booking', session = cash }) => tx`
    select public.create_reservation(${mode},${where},${pack},'Input Berbeda',${phone},'Alamat Input',
      ${mode === 'booking' ? 50001 : 100001},'Cash','weekday',${slot},${key},${session}) as number`;
  const slot = index => `2099-12-${String(index + 1).padStart(2,'0')}T15:00:00+07:00`;
  const verify = async (number, guest, kind = 'dp') => {
    const [row] = await db`select t.guest_id,p.kind from public.transactions t
      join public.payments p on p.transaction_id=t.id where t.transaction_number=${number}`;
    assert.deepEqual({ ...row }, { guest_id: guest, kind });
    assert.equal((await db`select p.transaction_id from public.payments p join public.transactions t
      on t.id=p.transaction_id where t.transaction_number=${number}`).length, 1);
  };
  for (let i = 0; i < ids.length; i++) {
    const input = { phone: alternatives[i], key: randomUUID(), slot: slot(i) };
    const [saved] = await act(reception, tx => direct(tx, input));
    assert.equal((await act(reception, tx => direct(tx, input)))[0].number, saved.number);
    await verify(saved.number, ids[i]);

    const offer = randomUUID();
    await act(supervisor, tx => quote(tx, offer, alternatives[i], slot(i + 5), room2));
    const [converted] = await act(reception, tx => transition(tx, offer));
    assert.equal(converted.result.status, 'CONVERTED');
    await verify(converted.result.transaction_number, ids[i]);
    const [g] = await db`select phone,full_name,address from public.guests where id=${ids[i]}`;
    assert.deepEqual({ ...g }, { phone: stored[i], full_name: 'Identitas Asli', address: 'Alamat Asli' });
  }
  assert.equal((await db`select * from public.guests`).length,4);
  console.log('PASS 08 ↔ +62/62 and formatted legacy: direct and conversion preserve guest_id, identity and one DP per Booking');

  const [walkin] = await act(supervisor, tx => direct(tx, { phone: alternatives[0], key: randomUUID(), slot: null, where: room2, mode: 'check_in' }));
  await verify(walkin.number, ids[0], 'payment');
  const combinedPhone = '+6283234567890';
  const combinedId = randomUUID(), componentId = randomUUID();
  const [combined] = await act(reception, tx => tx`
    select public.create_reservation_combined('booking',${room},${pack},'Input',${combinedPhone},'Alamat',
      jsonb_build_array(jsonb_build_object('method','QRIS','amount',50001,'idempotency_key',${componentId}::uuid)),
      'weekend',${slot(10)},${combinedId},'test',${cash},2) as result`);
  await verify(combined.result.transaction_number, ids[2]);
  const guestBefore = (await db`select id from public.guests`).length;
  // The existing explicit guest editor may change only its own row's format.
  await db`update public.guests set phone=${alternatives[1]} where id=${ids[1]}`;
  await assert.rejects(db`update public.guests set phone=${alternatives[0]} where id=${ids[1]}`,{code:'23505'});
  for (const [actor, role] of [[hk,'authenticated'],['','anon']]) {
    await assert.rejects(act(actor, tx => tx`select reservation_offer_private.resolve_guest('Test','081234567890','Test')`, role),{code:'42501'});
    await assert.rejects(act(actor, tx => direct(tx,{phone:alternatives[0],key:randomUUID(),slot:slot(12)}),role));
  }
  await assert.rejects(act(reception, tx => direct(tx, { phone:'081111111111',key:randomUUID(),slot:slot(12),session:randomUUID() })),{code:'23503'});
  assert.equal((await db`select id from public.guests`).length,guestBefore);
  assert.equal((await db`select id from public.transactions where scheduled_check_in=${slot(12)}`).length,0);
  console.log('PASS walk-in, combined writer, private ACL and rollback of guest/TRX on invalid session');

  const contestedSlot = slot(15);
  const outcomes = await Promise.allSettled([
    act(reception, tx=>direct(tx,{phone:stored[0],key:randomUUID(),slot:contestedSlot})),
    act(supervisor, tx=>direct(tx,{phone:alternatives[0],key:randomUUID(),slot:contestedSlot})),
  ]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  const granted = outcomes.find(r=>r.status==='fulfilled');
  await verify(granted.value[0].number, ids[0]);
  const [newRoom] = await db`insert into public.rooms values(gen_random_uuid(),${type},'09',true,'ready') returning id`;
  const newSlot = slot(17);
  await Promise.all([
    act(reception,tx=>direct(tx,{phone:'081111111111',key:randomUUID(),slot:newSlot})),
    act(supervisor,tx=>direct(tx,{phone:'+6281111111111',key:randomUUID(),slot:newSlot,where:newRoom.id})),
  ]);
  assert.equal((await db`select distinct guest_id from public.transactions where scheduled_check_in=${newSlot}`).length,1);
  assert.equal((await db`select id from public.guests`).length, guestBefore + 1);
  console.log('PASS two sessions: contested slot one TRX+DP; independent slots reuse one concurrently created guest');

  const saved = await db`select * from reservation_offer_private.booking_originals order by signature`;
  assert.equal(saved.length,2);
  const connection = await db.reserve();
  try {
    await connection.unsafe(await readFile('supabase/rollback/20261123_issue_140_booking_phone.sql','utf8'));
  } finally { connection.release(); }
  for (const original of saved) {
    const [row] = await db`select pg_get_functiondef(to_regprocedure(${original.signature})) as ddl`;
    assert.equal(row.ddl, original.original_definition);
  }
  assert.equal((await db`select to_regclass('public.guests_offer_canonical_wa_idx') as idx`)[0].idx,null);
  assert.equal((await db`select id from public.reservation_offers`).length,4);
  assert.equal((await db`select tgenabled from pg_trigger where tgname='reservation_offers_invalidate'`)[0].tgenabled,'D');
  await assert.rejects(act(owner, tx=>tx`select public.read_reservation_offers()`),{code:'42501'});
  console.log('PASS atomic rollback restores exact SQL, disables offer RPCs and retains offer history');
}, { combined: true });
