import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';

const require = createRequire(import.meta.url);
const runtimePath = resolve(process.env.HK_TEST_TOOLS ?? 'node_modules/.issue-133-tools');
const { default: EmbeddedPostgres } = await import(pathToFileURL(require.resolve('embedded-postgres', { paths: [runtimePath] })).href);
const owner = '10000000-0000-0000-0000-000000000001';
const hk = '10000000-0000-0000-0000-000000000002';
const supervisor = '10000000-0000-0000-0000-000000000003';
const outsider = '10000000-0000-0000-0000-000000000004';
const inactive = '10000000-0000-0000-0000-000000000005';
const room = '20000000-0000-0000-0000-000000000001';
const port = Number(process.env.HK_TEST_PORT ?? 55433);
const password = randomUUID();
const databaseDir = await mkdtemp(resolve(runtimePath, 'pg-'));
const embedded = new EmbeddedPostgres({
  databaseDir,
  port,
  user: 'postgres',
  password,
  authMethod: 'scram-sha-256',
  initdbFlags: ['--locale=C', '--encoding=UTF8'],
  postgresFlags: ['-c', 'listen_addresses=127.0.0.1'],
  onLog: () => {},
});
const migration = 'supabase/pending/20261123073104_issue_133_housekeeping_supplies.sql';

await embedded.initialise();
await embedded.start();
const db = postgres({ host: '127.0.0.1', port, database: 'postgres', username: 'postgres', password, max: 5 });
const actsAs = async (tx, id, role = 'authenticated') => {
  await tx.unsafe('set local role ' + role);
  await tx`select set_config('request.jwt.claim.sub', ${id}, true)`;
};
const session = (id, work, role) => db.begin(async tx => {
  await actsAs(tx, id, role);
  return work(tx);
});
const call = async (tx, requestId, action, payload) => {
  const [result] = await tx`select public.record_hk_operational_action(${requestId}, ${action}, ${tx.json(payload)}) as id`;
  return result.id;
};
const reject = (promise, code, message) => assert.rejects(promise, error => {
  assert.equal(error.code, code);
  if (message) assert.match(error.message, message);
  return true;
});

async function racing(firstWork, secondWork, expectedWait) {
  let release;
  let held;
  const locked = new Promise(resolve => { held = resolve; });
  const waitForRelease = new Promise(resolve => { release = resolve; });
  const first = db.begin(async tx => {
    await actsAs(tx, owner);
    try {
      return await firstWork(tx);
    } finally {
      held();
      await waitForRelease;
    }
  });
  await locked;
  const second = db.begin(async tx => {
    await actsAs(tx, owner);
    await tx`select set_config('application_name', 'issue-133-waiting', true)`;
    return secondWork(tx);
  });
  const result = Promise.allSettled([first, second]);
  let waiting;
  try {
    for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
      const [row] = await db`select wait_event from pg_stat_activity
        where application_name = 'issue-133-waiting' and wait_event_type = 'Lock'`;
      waiting = row?.wait_event;
      if (!waiting) await new Promise(resolve => setTimeout(resolve, 20));
    }
  } finally {
    release();
    await result;
  }
  assert.equal(waiting, expectedWait);
  return result;
}

try {
  await db.unsafe(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create type public.app_role as enum ('owner', 'employee');
    create type public.employee_position as enum ('housekeeping', 'supervisor', 'receptionist');
    create table public.user_roles (user_id uuid, role public.app_role, primary key (user_id, role));
    create table public.employees (
      id uuid primary key default gen_random_uuid(), user_id uuid, name text, active boolean, position public.employee_position
    );
    create table public.rooms (id uuid primary key, room_number text not null, active boolean not null, status text not null);
    create function public.has_role(_user_id uuid, _role public.app_role) returns boolean
      language sql stable security definer set search_path = '' as $$
      select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
    $$;
  `);
  const roleFoundation = await readFile('supabase/migrations/20261003000011_role_permission_foundation.sql', 'utf8');
  for (const helper of ['has_employee_position', 'can_housekeeping']) {
    const ddl = roleFoundation.match(new RegExp('create or replace function public\\.' + helper + '\\([\\s\\S]+?\\$\\$;', 'i'));
    assert.ok(ddl, 'Permission helper must match repository contract');
    await db.unsafe(ddl[0]);
  }
  await db`insert into public.user_roles values
    (${owner}, 'owner'), (${hk}, 'employee'), (${supervisor}, 'employee'), (${outsider}, 'employee'), (${inactive}, 'employee')`;
  await db`insert into public.employees (user_id, name, active, position) values
    (${hk}, 'Petugas A', true, 'housekeeping'), (${supervisor}, 'Supervisor A', true, 'supervisor'),
    (${outsider}, 'Front Desk', true, 'receptionist'), (${inactive}, 'Petugas Nonaktif', false, 'housekeeping')`;
  await db`insert into public.rooms values (${room}, '07', true, 'occupied')`;
  const schemaConnection = await db.reserve();
  try {
    await schemaConnection.unsafe(await readFile(migration, 'utf8'));
  } finally {
    schemaConnection.release();
  }
  const baseRef = process.env.HK_BASE_REF ?? 'c51b28e';
  assert.equal(execFileSync('git', ['diff', baseRef, '--', 'src/components/perawatan-berkala.tsx',
    'src/components/housekeeping-referensi.tsx', 'src/components/housekeeping.css',
    'supabase/migrations/20261013000000_housekeeping_checklists_maintenance.sql'], { encoding: 'utf8' }), '');
  console.log('PASS maintenance component, CSS, reference panel and RPC definition match main baseline');

  const initial = { name: 'Handuk Uji', unit: 'buah', quantity: 10, minimum: 2, note: 'Hitung fisik' };
  const id = randomUUID();
  assert.equal((await session(owner, tx => tx`select * from public.hk_supply_items`)).length, 0);
  await reject(session(hk, tx => call(tx, id, 'initial', initial)), '42501', /Hanya Owner/);
  await reject(session(supervisor, tx => call(tx, id, 'initial', initial)), '42501', /Hanya Owner/);
  await reject(session(outsider, tx => call(tx, id, 'initial', initial)), '42501', /Akses Housekeeping ditolak/);
  await reject(session(inactive, tx => call(tx, id, 'report', { note: 'Uji' })), '42501', /Akses Housekeeping ditolak/);
  await reject(session('', tx => call(tx, id, 'initial', initial), 'anon'), '42501', /permission denied/);
  await reject(session(owner, tx => call(tx, id, 'initial', { ...initial, quantity: -1 })), '22023', /stok awal aktual/);
  await reject(session(owner, tx => call(tx, id, 'initial', { ...initial, quantity: 1.5 })), '22023', /bilangan bulat/);
  await reject(session(owner, tx => call(tx, id, 'initial', { ...initial, quantity: 2147483648 })), '22023', /di luar batas/);
  await reject(session(owner, tx => call(tx, id, 'initial', { ...initial, note: '\t' })), '22023', /Lengkapi catatan/);
  const item = await session(owner, tx => call(tx, id, 'initial', initial));
  assert.equal(await session(owner, tx => call(tx, id, 'initial', initial)), item);
  await reject(session(owner, tx => call(tx, id, 'initial', { ...initial, quantity: 20 })), '22023', /ID permintaan/);
  await reject(session(owner, tx => call(tx, randomUUID(), 'initial', { ...initial, name: 'handuk uji' })), '23505', /sudah terdaftar/);
  assert.equal((await session(hk, tx => tx`select quantity from public.hk_supply_items where id = ${item}`))[0].quantity, 10);
  assert.equal((await session(outsider, tx => tx`select * from public.hk_supply_items`)).length, 0);
  await reject(session(hk, tx => tx`update public.hk_supply_items set quantity = 50`), '42501', /permission denied/);
  await reject(session(owner, tx => tx`delete from public.hk_operational_events`), '42501', /permission denied/);
  await reject(session(owner, tx => tx`insert into public.hk_operational_events default values`), '42501', /permission denied/);
  console.log('PASS actual opening count, no seed, authorized reads and writes, outsider/anon denied, input and audit protection');

  const deduction = { supplyId: item, quantity: -7, note: 'Pemakaian terverifikasi' };
  const [applied, overdraw] = await racing(
    tx => call(tx, randomUUID(), 'adjust', deduction),
    tx => call(tx, randomUUID(), 'adjust', deduction),
    'transactionid',
  );
  assert.equal(applied.value, item);
  await reject(Promise.reject(overdraw.reason), '22023', /saldo akhir/);
  assert.equal((await session(hk, tx => tx`select quantity from public.hk_supply_items`))[0].quantity, 3);

  const retryId = randomUUID();
  const addition = { supplyId: item, quantity: 5, note: 'Kiriman diterima' };
  const duplicates = await racing(
    tx => call(tx, retryId, 'adjust', addition),
    tx => call(tx, retryId, 'adjust', addition),
    'advisory',
  );
  assert.deepEqual(duplicates, [{ status: 'fulfilled', value: item }, { status: 'fulfilled', value: item }]);
  await session(owner, tx => call(tx, randomUUID(), 'minimum', { supplyId: item, minimum: 8, note: 'Atur batas' }));
  const [record] = await session(hk, tx => tx`select quantity, minimum from public.hk_supply_items`);
  assert.deepEqual({ ...record }, { quantity: 8, minimum: 8 });
  const audit = await session(hk, tx => tx`select actor_id, actor_name, balance_before, balance_after
    from public.hk_operational_events where request_id = ${retryId}`);
  assert.equal(audit.length, 1);
  assert.deepEqual({ ...audit[0] }, { actor_id: owner, actor_name: 'Owner', balance_before: 3, balance_after: 8 });
  console.log('PASS concurrent overdraw prevented, concurrent duplicate applies once, read-after-write, minimum and actor audit');

  const reportPayload = { roomId: room, supplyId: item, category: 'kekurangan', priority: 'tinggi', note: 'Perlu satu handuk tambahan' };
  const reportId = randomUUID();
  await reject(session(hk, tx => call(tx, randomUUID(), 'report', { ...reportPayload, roomId: randomUUID() })), '22023', /Kamar operasional/);
  await reject(session(hk, tx => call(tx, randomUUID(), 'report', { ...reportPayload, priority: 'darurat' })), '22023', /prioritas/);
  const issue = await session(hk, tx => call(tx, reportId, 'report', reportPayload));
  assert.equal(await session(hk, tx => call(tx, reportId, 'report', reportPayload)), issue);
  const [saved] = await session(supervisor, tx => tx`select room_number, reported_by, reported_by_name, status
    from public.hk_issue_reports where id = ${issue}`);
  assert.deepEqual({ ...saved }, { room_number: '07', reported_by: hk, reported_by_name: 'Petugas A', status: 'DILAPORKAN' });
  assert.equal((await session(outsider, tx => tx`select id from public.hk_issue_reports`)).length, 0);
  assert.equal((await session(outsider, tx => tx`select request_id from public.hk_operational_events`)).length, 0);
  const followUp = { issueId: issue, expectedStatus: 'DILAPORKAN', status: 'DIPROSES', note: 'Diperiksa' };
  await reject(session(hk, tx => call(tx, randomUUID(), 'follow_up', followUp)), '42501', /Owner atau Supervisor/);
  await reject(session(supervisor, tx => call(tx, randomUUID(), 'follow_up', { ...followUp, status: 'SELESAI' })), '22023', /tidak valid/);
  await session(supervisor, tx => call(tx, randomUUID(), 'follow_up', followUp));
  await reject(session(owner, tx => call(tx, randomUUID(), 'follow_up', followUp)), '22023', /sudah berubah/);
  await session(owner, tx => call(tx, randomUUID(), 'follow_up', {
    ...followUp, expectedStatus: 'DIPROSES', status: 'SELESAI', note: 'Ditindaklanjuti',
  }));
  const trail = await session(hk, tx => tx`select actor_name, status_after from public.hk_operational_events
    where issue_id = ${issue} order by created_at`);
  assert.deepEqual(Array.from(trail, x => [x.actor_name, x.status_after]), [
    ['Petugas A', 'DILAPORKAN'], ['Supervisor A', 'DIPROSES'], ['Owner', 'SELESAI'],
  ]);
  assert.equal((await db`select status from public.rooms where id = ${room}`)[0].status, 'occupied');
  assert.equal((await session(hk, tx => tx`select quantity from public.hk_supply_items`))[0].quantity, 8);
  console.log('PASS report and follow-up read-after-write, invalid/stale transitions, room and stock unaffected by reports');
} finally {
  await db.end();
  await embedded.stop();
  await rm(databaseDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    .catch(error => console.warn('Disposable cluster cleanup:', error.message));
}
