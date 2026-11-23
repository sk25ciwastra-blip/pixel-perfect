import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';

const require = createRequire(import.meta.url);
const runtime = resolve(process.env.OFFER_TEST_TOOLS ?? 'node_modules/.issue-140-tools');
const { default: EmbeddedPostgres } = await import(pathToFileURL(require.resolve('embedded-postgres', { paths: [runtime] })).href);
const databaseDir = await mkdtemp(resolve(runtime, 'offers-pg-'));
const password = randomUUID();
const port = Number(process.env.OFFER_TEST_PORT ?? 55431);
const server = new EmbeddedPostgres({ databaseDir, port, password, user: 'postgres',
  authMethod: 'scram-sha-256', initdbFlags: ['--locale=C', '--encoding=UTF8'],
  postgresFlags: ['-c', 'listen_addresses=127.0.0.1'], onLog: () => {} });
await server.initialise();
await server.start();
const db = postgres({ host: '127.0.0.1', port, database: 'postgres', username: 'postgres', password, max: 6 });

try {
  await db.unsafe(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, banned_until timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;

    create type public.app_role as enum ('owner','employee');
    create type public.employee_position as enum ('receptionist','supervisor','housekeeping');
    create type public.room_status as enum ('ready','occupied');
    create type public.transaction_status as enum ('booking','check_in','check_out','cancelled');
    create table public.user_roles(user_id uuid, role public.app_role);
    create table public.employees(user_id uuid, position public.employee_position, active boolean);
    create table public.finance_settings(id boolean primary key, minimum_dp_mode text, minimum_dp_value numeric);
    insert into public.finance_settings values(true,'PERCENTAGE',50);
    create table public.guests(id uuid primary key default gen_random_uuid(), full_name text, phone text unique, address text);
    create table public.room_types(id uuid primary key, name text, pricing_group text);
    create table public.rooms(id uuid primary key, room_type_id uuid, room_number text, active boolean, status public.room_status);
    create table public.packages(id uuid primary key, name text, active boolean, duration_minutes integer, time_mode text,
      checkin_start_time time, checkin_end_time time, checkout_time time);
    create table public.package_room_type_prices(package_id uuid, pricing_group text, weekday_price numeric, weekend_price numeric);
    create sequence public.fixture_tx_no;
    create table public.transactions(id uuid primary key default gen_random_uuid(), guest_id uuid references public.guests,
      room_id uuid, package_id uuid, transaction_number text unique default 'TEST-'||nextval('public.fixture_tx_no'),
      status public.transaction_status, created_by uuid, price_snapshot numeric, day_mode text,
      scheduled_check_in timestamptz, scheduled_check_out timestamptz, started_at timestamptz, ends_at timestamptz);
    create table public.payments(transaction_id uuid, amount numeric, method text, kind text, recorded_by uuid,
      idempotency_key uuid unique, cash_session_id uuid not null);
    create table public.fixture_open_cash(id uuid primary key);
    alter table public.payments add foreign key (cash_session_id) references public.fixture_open_cash;
    create table public.finance_reservation_idempotency(idempotency_key uuid primary key, request_fingerprint text,
      created_by uuid, transaction_id uuid, transaction_number text);
    create table public.operational_calendar(calendar_date date, owner_override text, event_type text, is_national_holiday boolean);
    create table public.fixture_training(actor uuid);
    create function public.has_role(actor uuid, wanted public.app_role) returns boolean language sql stable
    security definer as $$select exists(select 1 from public.user_roles where user_id=actor and role=wanted)$$;
    create function public.finance_training_is_restricted(actor_id uuid) returns boolean language sql stable
    as $$select exists(select 1 from public.fixture_training where actor=actor_id)$$;
    create function public.finance_is_booking_operator(actor uuid) returns boolean language sql stable
    as $$select not public.finance_training_is_restricted(actor)$$;
  `);
  const copyFunction = async (file, name, delimiter = '\\$\\$') => {
    const source = await readFile('supabase/migrations/' + file, 'utf8');
    const ddl = source.match(new RegExp('create or replace function public\\.' + name + '\\([\\s\\S]+?' + delimiter + ';', 'i'));
    assert.ok(ddl, 'Missing official function ' + name);
    await db.unsafe(ddl[0]);
  };
  await copyFunction('20261003000011_role_permission_foundation.sql','has_employee_position');
  await copyFunction('20261003000002_package_time_engine.sql','calculate_package_stay_times');
  await copyFunction('20261006000007_scheduled_booking_foundation.sql','calculate_scheduled_booking_times');
  await copyFunction('20261006000012_calendar_event_types.sql','get_operational_day_mode');
  await copyFunction('20261015000002_finance_150_supervisor_alignment.sql','create_reservation','\\$function\\$');
  const migration = async name => {
    const session = await db.reserve();
    try { await session.unsafe(await readFile('supabase/pending/' + name, 'utf8')); } finally { session.release(); }
  };
  await migration('20261123084929_booking_quote_read_guards.sql');
  await migration('20261123101906_issue_140_offer_queue.sql');

  const [owner, reception, supervisor, hk, trainee, room, room2, type, pack, cash] = Array.from({length:10}, randomUUID);
  await db`insert into auth.users(id) values (${owner}),(${reception}),(${supervisor}),(${hk}),(${trainee})`;
  await db`insert into public.user_roles values (${owner},'owner'),(${reception},'employee'),(${supervisor},'employee'),(${hk},'employee'),(${trainee},'employee')`;
  await db`insert into public.employees values (${reception},'receptionist',true),(${supervisor},'supervisor',true),(${hk},'housekeeping',true),(${trainee},'receptionist',true)`;
  await db`insert into public.fixture_training values(${trainee})`;
  await db`insert into public.fixture_open_cash values(${cash})`;
  await db`insert into public.room_types values(${type},'Superior','S')`;
  await db`insert into public.rooms values(${room},${type},'07',true,'ready'),(${room2},${type},'08',true,'ready')`;
  await db`insert into public.packages values(${pack},'Paket Uji',true,120,'duration',null,null,null)`;
  await db`insert into public.package_room_type_prices values(${pack},'S',100001,100001)`;
  const act = (actor, run, role = 'authenticated') => db.begin(async tx => {
    await tx.unsafe('set local role ' + role);
    await tx`select set_config('request.jwt.claim.sub', ${actor}, true)`;
    return run(tx);
  });
  const quote = (tx,id,phone = '081234567890',start = '2099-11-28T15:00:00+07:00', location = room) => tx`
    select public.create_reservation_offer(${id},'Tamu Baru',${phone},'Alamat Form',${location},${pack},${start}) as result`;
  const list = tx => tx`select public.read_reservation_offers() as result`;
  const transition = (tx, id, action = 'convert', amount = 50001, verified = true, session = cash) => tx`
    select public.transition_reservation_offer(${id},${action},${amount},'Cash',${session},${verified}) as result`;
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
} finally {
  await db.end();
  await server.stop();
  await rm(databaseDir,{recursive:true,force:true,maxRetries:10,retryDelay:200}).catch(error => console.warn(error.message));
}
