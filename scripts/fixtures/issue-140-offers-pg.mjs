import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';

export async function withOfferFixture(run, { combined = false } = {}) {
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
    create table public.payments(id uuid default gen_random_uuid(), transaction_id uuid, amount numeric, method text, kind text, recorded_by uuid,
      idempotency_key uuid unique, cash_session_id uuid not null);
    create table public.fixture_open_cash(id uuid primary key);
    alter table public.payments add foreign key (cash_session_id) references public.fixture_open_cash;
    create table public.finance_reservation_idempotency(idempotency_key uuid primary key, request_fingerprint text,
      created_by uuid, transaction_id uuid, transaction_number text);
    create table public.operational_calendar(calendar_date date, owner_override text, event_type text, is_national_holiday boolean);
    create table public.finance_training_assignments(trainee_user_id uuid, status text,
      starts_on date default current_date, created_at timestamptz default clock_timestamp());
    create function public.has_role(actor uuid, wanted public.app_role) returns boolean language sql stable
    security definer as $$select exists(select 1 from public.user_roles where user_id=actor and role=wanted)$$;
  `);
  const copyFunction = async (file, name, delimiter = '\\$\\$') => {
    const source = await readFile('supabase/migrations/' + file, 'utf8');
    const ddl = source.match(new RegExp('create or replace function public\\.' + name + '\\([\\s\\S]+?' + delimiter + ';', 'i'));
    assert.ok(ddl, 'Missing official function ' + name);
    await db.unsafe(ddl[0]);
  };
  await copyFunction('20261003000011_role_permission_foundation.sql','has_employee_position');
  await copyFunction('20261018000000_finance_training_enforcement.sql','finance_training_is_restricted','\\$function\\$');
  await db.unsafe(`
    create function public.finance_is_booking_operator(actor uuid) returns boolean language sql stable
    security definer as $$select not public.finance_training_is_restricted(actor) and (
      public.has_role(actor, 'owner') or public.has_employee_position(actor, array['receptionist','supervisor']::public.employee_position[])
    )$$;
  `);
  await copyFunction('20261003000002_package_time_engine.sql','calculate_package_stay_times');
  await copyFunction('20261006000007_scheduled_booking_foundation.sql','calculate_scheduled_booking_times');
  await copyFunction('20261006000012_calendar_event_types.sql','get_operational_day_mode');
  await copyFunction('20261015000002_finance_150_supervisor_alignment.sql','create_reservation','\\$function\\$');
  await db.unsafe(`
    revoke all on function public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid) from public, anon;
    grant execute on function public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid) to authenticated;
  `);
  const migration = async name => {
    const session = await db.reserve();
    try {
      await session.unsafe(await readFile('supabase/pending/' + name, 'utf8'));
    } catch (error) {
      await session.unsafe('rollback');
      throw error;
    } finally {
      session.release();
    }
  };
  if (combined) {
    await db.unsafe(`
      alter table public.transactions add guest_count integer, add extra_guest_count integer,
        add extra_guest_unit_price numeric, add extra_guest_charge numeric;
      create table public.finance_payment_batch_idempotency (
        request_idempotency_key uuid primary key, operation text, request_fingerprint text, created_by uuid,
        transaction_id uuid, transaction_number text, payment_ids jsonb not null default '[]'::jsonb
      );
    `);
    await copyFunction('20261104000000_atomic_combined_payments.sql','create_reservation_combined','\\$function\\$');
    await copyFunction('20261018000000_finance_training_enforcement.sql','create_training_reservation','\\$function\\$');
    await copyFunction('20261104000000_atomic_combined_payments.sql','create_training_reservation_combined','\\$function\\$');
    await db.unsafe(`
      revoke all on function public.create_reservation_combined(text,uuid,uuid,text,text,text,jsonb,text,timestamptz,uuid,text,uuid,integer) from public, anon;
      grant execute on function public.create_reservation_combined(text,uuid,uuid,text,text,text,jsonb,text,timestamptz,uuid,text,uuid,integer) to authenticated;
    `);
  }
  if (combined) {
    await assert.rejects(migration('20261123101906_issue_140_offer_queue.sql'), /Prasyarat penawaran belum terpasang/);
    assert.equal((await db`select to_regnamespace('reservation_offer_private') as ns`)[0].ns, null);
  }
  await migration('20261123084929_booking_quote_read_guards.sql');
  await migration('20261123101906_issue_140_offer_queue.sql');

  const [owner, reception, supervisor, hk, trainee, room, room2, type, pack, cash] = Array.from({length:10}, randomUUID);
  await db`insert into auth.users(id) values (${owner}),(${reception}),(${supervisor}),(${hk}),(${trainee})`;
  await db`insert into public.user_roles values (${owner},'owner'),(${reception},'employee'),(${supervisor},'employee'),(${hk},'employee'),(${trainee},'employee')`;
  await db`insert into public.employees values (${reception},'receptionist',true),(${supervisor},'supervisor',true),(${hk},'housekeeping',true),(${trainee},'receptionist',true)`;
  await db`insert into public.finance_training_assignments(trainee_user_id,status) values(${trainee},'ACTIVE')`;
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
  await run({ db, act, quote, list, transition, owner, reception, supervisor, hk, trainee, room, room2, type, pack, cash });
} finally {
  await db.end();
  await server.stop();
  await rm(databaseDir,{recursive:true,force:true,maxRetries:10,retryDelay:200}).catch(error => console.warn(error.message));
}
}
