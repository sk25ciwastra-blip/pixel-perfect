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
} finally {
  await db.end();
  await server.stop();
  await rm(databaseDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    .catch(error => console.warn('Disposable cluster cleanup:', error.message));
}
