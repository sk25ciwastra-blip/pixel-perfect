import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';

const require = createRequire(import.meta.url);
const runtime = resolve(process.env.BOOKING_QUOTE_TEST_TOOLS ?? 'node_modules/.issue-132-tools');
const path = require.resolve('embedded-postgres', { paths: [runtime] });
const { default: EmbeddedPostgres } = await import(pathToFileURL(path).href);
const databaseDir = await mkdtemp(resolve(runtime, 'quote-pg-'));
const port = Number(process.env.BOOKING_QUOTE_TEST_PORT ?? 55432);
const password = randomUUID();
const server = new EmbeddedPostgres({
  databaseDir, port, password, user: 'postgres', authMethod: 'scram-sha-256',
  initdbFlags: ['--locale=C', '--encoding=UTF8'],
  postgresFlags: ['-c', 'listen_addresses=127.0.0.1'],
  onLog: () => {},
});

await server.initialise();
await server.start();
const db = postgres({ host: '127.0.0.1', port, database: 'postgres', username: 'postgres', password, max: 1 });
try {
  await db.unsafe(`
    create table public.packages (
      id uuid primary key default gen_random_uuid(), name text, active boolean,
      duration_minutes integer, time_mode text, slot_start_time time, checkin_start_time time, checkin_end_time time, checkout_time time
    );
    create table public.operational_calendar (
      calendar_date date primary key, owner_override text, event_type text, is_national_holiday boolean
    );
  `);
  const fixture = await readFile('supabase/migrations/20261006000004_official_package_catalog.sql', 'utf8');
  const catalog = fixture.match(/as \(\s*(VALUES\s+\([\s\S]+?)\s*\)\s*SELECT 1\s*FROM public\.packages p/i);
  assert.ok(catalog, 'Official timing catalog fixture must be available');
  await db.unsafe(`
    insert into public.packages (name, duration_minutes, time_mode, slot_start_time, checkin_start_time, checkin_end_time, checkout_time, active)
    select expected.*, true from (${catalog[1]}) expected
  `);
  const migrations = {
    '20261003000002_package_time_engine.sql': 'calculate_package_stay_times',
    '20261006000007_scheduled_booking_foundation.sql': 'calculate_scheduled_booking_times',
    '20261006000012_calendar_event_types.sql': 'get_operational_day_mode',
  };
  for (const [file, functionName] of Object.entries(migrations)) {
    const source = await readFile('supabase/migrations/' + file, 'utf8');
    const ddl = source.match(new RegExp('create or replace function public\\.' + functionName + '\\([\\s\\S]+?\\$\\$;', 'i'));
    assert.ok(ddl, functionName);
    await db.unsafe(ddl[0]);
  }
  const stay = await db.begin('read only', async tx => {
    const cases = [
      ['Paket Pagi', '2026-11-27T08:30:00+07:00', '2026-11-27T09:00:00.000Z'],
      ['Paket Malam', '2026-11-27T22:00:00+07:00', '2026-11-28T01:00:00.000Z'],
      ['Paket Malam', '2026-11-28T03:00:00+07:00', '2026-11-28T01:00:00.000Z'],
      ['Paket Harian', '2026-11-28T13:00:00+07:00', '2026-11-29T05:00:00.000Z'],
    ];
    return Promise.all(cases.map(async ([name, input, checkout]) => {
      const [row] = await tx`select s.* from public.packages p
        cross join lateral public.calculate_scheduled_booking_times(p.id, ${input}::timestamptz) s where p.name = ${name}`;
      assert.equal(row.scheduled_check_in.toISOString(), new Date(input).toISOString());
      assert.equal(row.scheduled_check_out.toISOString(), checkout);
      return name;
    }));
  });
  assert.equal(stay.length, 4);
  await assert.rejects(db.begin('read only', tx => tx`select s.* from public.packages p cross join lateral
    public.calculate_scheduled_booking_times(p.id, '2026-11-27T07:59:00+07:00') s where p.name = 'Paket Pagi'`), /Check-in di luar jam/);
  await db`insert into public.operational_calendar values
    ('2026-11-25', null, 'national_holiday', false), ('2026-11-28', 'weekday', 'national_holiday', true)`;
  const [days] = await db.begin('read only', tx => tx`select
    public.get_operational_day_mode('2026-11-24') as weekday,
    public.get_operational_day_mode('2026-11-27') as friday,
    public.get_operational_day_mode('2026-11-25') as holiday,
    public.get_operational_day_mode('2026-11-28') as override`);
  assert.deepEqual({ ...days }, { weekday: 'weekday', friday: 'weekend', holiday: 'weekend', override: 'weekday' });
  console.log('PASS official read-only timing for Pagi, Malam, Harian, invalid hour, weekday/weekend, holiday and Owner override');

  await db.unsafe(`
    create role authenticated;
    create role anon;
    create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, banned_until timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;
    create type public.app_role as enum ('owner', 'employee');
    create type public.employee_position as enum ('receptionist', 'supervisor', 'housekeeping');
    create type public.room_status as enum ('ready', 'occupied');
    create table public.user_roles (user_id uuid, role public.app_role);
    create table public.employees (user_id uuid, position public.employee_position, active boolean);
    create function public.has_role(_user_id uuid, _role public.app_role) returns boolean
      language sql stable security definer set search_path = '' as $$
      select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
    $$;
    create table public.finance_settings (
      id boolean primary key, minimum_dp_mode text, minimum_dp_value numeric, secret_finance_column text
    );
    insert into public.finance_settings values (true, 'PERCENTAGE', 42.5, 'restricted');
    alter table public.finance_settings enable row level security;
    grant select on public.finance_settings to authenticated;
    create policy finance_settings_read on public.finance_settings for select to authenticated
      using (public.has_role(auth.uid(), 'owner'::public.app_role));
    create table public.rooms (id uuid primary key, active boolean, status public.room_status);
    create table public.transactions (
      room_id uuid, status text, scheduled_check_in timestamptz, scheduled_check_out timestamptz,
      started_at timestamptz, ends_at timestamptz
    );
    alter table public.transactions enable row level security;
    grant select on public.transactions to authenticated;
  `);
  const roleSource = await readFile('supabase/migrations/20261003000011_role_permission_foundation.sql', 'utf8');
  await db.unsafe(roleSource.match(/create or replace function public\.has_employee_position\([\s\S]+?\$\$;/i)[0]);
  await db.unsafe(await readFile('supabase/pending/20261123084929_booking_quote_read_guards.sql', 'utf8'));

  const [owner, receptionist, supervisor, hk, suspended, banned, outsider, room, otherRoom] = Array.from({ length: 9 }, () => randomUUID());
  await db`insert into auth.users values (${owner}, null), (${receptionist}, null), (${supervisor}, now()-interval '1 day'),
    (${hk}, null), (${suspended}, null), (${banned}, now()+interval '1 day'), (${outsider}, null)`;
  await db`insert into public.user_roles values (${owner}, 'owner'), (${receptionist}, 'employee'),
    (${supervisor}, 'employee'), (${hk}, 'employee'), (${suspended}, 'employee'), (${banned}, 'employee')`;
  await db`insert into public.employees values (${receptionist}, 'receptionist', true), (${supervisor}, 'supervisor', true),
    (${hk}, 'housekeeping', true), (${suspended}, 'receptionist', false), (${banned}, 'supervisor', true), (${outsider}, 'supervisor', true)`;
  await db`insert into public.rooms values (${room}, true, 'ready'), (${otherRoom}, true, 'ready')`;
  const [{ id: packageId }] = await db`select id from public.packages where name = 'Paket Harian'`;
  const actAs = (actor, run, role = 'authenticated') => db.begin('read only', async tx => {
    await tx.unsafe('set local role ' + role);
    await tx`select set_config('request.jwt.claim.sub', ${actor}, true)`;
    return run(tx);
  });
  const dp = tx => tx`select * from public.get_booking_quote_minimum_dp()`;
  const schedule = tx => tx`select * from public.check_booking_quote_schedule(
    ${room}, ${packageId}, '2099-11-28T13:00:00+07:00')`;
  for (const actor of [owner, receptionist, supervisor]) {
    const [setting] = await actAs(actor, dp);
    assert.deepEqual({ ...setting }, { minimum_dp_mode: 'PERCENTAGE', minimum_dp_value: '42.5' });
    const rows = await actAs(actor, tx => tx`select * from public.finance_settings`);
    assert.equal(rows.length, actor === owner ? 1 : 0);
    assert.equal((await actAs(actor, schedule))[0].has_conflict, false);
  }
  for (const actor of [hk, suspended, banned, outsider, '']) {
    await assert.rejects(actAs(actor, dp), { code: '42501' });
    await assert.rejects(actAs(actor, schedule), { code: '42501' });
  }
  for (const role of ['anon', 'service_role']) {
    await assert.rejects(actAs(owner, dp, role), { code: '42501' });
    await assert.rejects(actAs(owner, schedule, role), { code: '42501' });
  }
  await db`update public.finance_settings set minimum_dp_mode = 'AMOUNT', minimum_dp_value = 72500.25`;
  assert.deepEqual({ ...(await actAs(receptionist, dp))[0] }, { minimum_dp_mode: 'AMOUNT', minimum_dp_value: '72500.25' });
  console.log('PASS scoped DP projection, updated config, unchanged full-row RLS, active roles and denied roles');

  const isConflict = async expected => assert.equal((await actAs(supervisor, schedule))[0].has_conflict, expected);
  await db`insert into public.transactions values
    (${room}, 'booking', '2099-11-27T13:00:00+07:00', '2099-11-28T13:00:00+07:00', null, null),
    (${room}, 'booking', '2099-11-29T12:00:00+07:00', '2099-11-30T12:00:00+07:00', null, null),
    (${otherRoom}, 'booking', '2099-11-28T13:00:00+07:00', '2099-11-29T12:00:00+07:00', null, null),
    (${room}, 'check_out', null, null, '2099-11-28T13:00:00+07:00', '2099-11-29T12:00:00+07:00')`;
  await isConflict(false);
  await db`insert into public.transactions values
    (${room}, 'booking', '2099-11-28T12:00:00+07:00', '2099-11-28T14:00:00+07:00', null, null)`;
  await isConflict(true);
  await db`delete from public.transactions where room_id = ${room}`;
  await db`insert into public.transactions values (${room}, 'booking', null, null, null, null)`;
  await isConflict(true);
  await db`delete from public.transactions where room_id = ${room}`;
  await db`insert into public.transactions values
    (${room}, 'check_in', null, null, '2099-11-28T12:00:00+07:00', '2099-11-28T13:00:00+07:00')`;
  await isConflict(false);
  await db`update public.transactions set ends_at = '2099-11-28T14:00:00+07:00' where room_id = ${room}`;
  await isConflict(true);
  await db`update public.transactions set ends_at = null where room_id = ${room}`;
  await isConflict(true);
  await db`update public.transactions set started_at = now()-interval '2 hours', ends_at = now()-interval '1 hour' where room_id = ${room}`;
  await isConflict(true);
  await db`delete from public.transactions where room_id = ${room}`;
  await db`update public.rooms set status = 'occupied' where id = ${room}`;
  await isConflict(true);
  await db`update public.rooms set active = false where id = ${room}`;
  await assert.rejects(actAs(supervisor, schedule), /Kamar tidak aktif/);
  console.log('PASS strict Booking overlap, adjacent windows, active stays, incomplete/overdue occupancy and inactive rooms');
} finally {
  await db.end();
  await server.stop();
  await rm(databaseDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    .catch(error => console.warn('Disposable cluster cleanup:', error.message));
}
