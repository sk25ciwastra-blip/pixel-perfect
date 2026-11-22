// In-memory identities in a new loopback-only PostgreSQL cluster. No app env files.
// Usage: node scripts/owner-delete-runtime-tests.cjs <pg-bin> [postgrest-executable]
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { createHmac, randomBytes } = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const postgres = require('postgres');

const pgBin = process.argv[2];
if (!pgBin) throw new Error('Supply a local PostgreSQL bin directory.');
const archiveOnly = process.argv[3] === '--archive';
const postgrest = archiveOnly ? undefined : process.argv[3];
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'issue-99-fixtures-'));
const cluster = path.join(root, 'cluster');
const loopback = '127.0.0.1';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const codes = { employee: n => `B25EMP-${n}`, transaction: n => `BTRDTRX-${n}` };
const bin = name => path.join(pgBin, name + (process.platform === 'win32' ? '.exe' : ''));
const run = (name, args) => execFileSync(bin(name), args, {
  windowsHide: true, timeout: 30000, stdio: ['ignore', 'ignore', 'pipe'],
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer().once('error', reject).listen(0, loopback, () => {
      const port = socket.address().port;
      socket.close(error => error ? reject(error) : resolve(port));
    });
  });
}
function jwt(claims, secret) {
  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const signing = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}`;
  return `${signing}.${createHmac('sha256', secret).update(signing).digest('base64url')}`;
}

async function main() {
  let server;
  let sql;
  let api;
  const port = await freePort();
  try {
    run('initdb', ['-D', cluster, '-U', 'postgres', '--auth-local=trust', '--auth-host=trust', '--no-locale']);
    const log = fs.openSync(path.join(root, 'server.log'), 'a');
    try {
      server = spawn(bin('postgres'), ['-D', cluster, '-h', loopback, '-p', String(port)], {
        windowsHide: true, stdio: ['ignore', log, log],
      });
    } finally {
      fs.closeSync(log);
    }
    let listening = false;
    for (let i = 0; i < 50 && !listening; i++) {
      try {
        run('pg_isready', ['-h', loopback, '-p', String(port)]);
        listening = true;
      } catch {
        await sleep(100);
      }
    }
    assert.ok(listening, 'isolated PostgreSQL ready');
    const connection = { host: loopback, port, database: 'postgres', username: 'postgres' };
    sql = postgres({ ...connection, max: 1 });
    await sql.unsafe(fs.readFileSync('scripts/fixtures/owner-delete.sql', 'utf8'));
    await sql.unsafe(fs.readFileSync('supabase/pending/20261122000000_owner_delete.sql', 'utf8'));
    await sql.end();
    sql = postgres({ ...connection, max: 5 });

    const session = n => id(100 + n);
    const claims = (n, sid = session(n)) => ({ role: 'authenticated', sub: id(n), session_id: sid });
    const as = (actor, test, role = 'authenticated', token = claims(actor)) =>
      sql.begin(async tx => {
        await tx.unsafe(`SET LOCAL ROLE ${role}`);
        await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify(token)}, true)`;
        return test(tx);
      });
    const invoke = async (tx, kind, target, confirmation = codes[kind](target), demo = true) => {
      const [row] = await tx`SELECT public.owner_delete_demo(${kind}, ${id(target)}, ${confirmation}, ${demo}) AS result`;
      return row.result;
    };
    const owner = (...args) => as(1, tx => invoke(tx, ...args));
    const denied = { code: '42501' };

    if (archiveOnly) {
      await require('./owner-demo-archive-runtime.cjs')({
        sql, as, id, connection, postgres, root, freePort, sleep, jwt, gotrue: process.argv[4],
      });
      return;
    }

    await assert.rejects(as(3, tx => invoke(tx, 'employee', 11)), denied);
    await assert.rejects(as(3, tx => invoke(tx, 'transaction', 20)), denied);
    await assert.rejects(as(1, tx => invoke(tx, 'transaction', 20), 'anon', {}), denied);
    await assert.rejects(as(1, tx => invoke(tx, 'transaction', 20), 'authenticated', claims(1, id(999))), denied);
    await assert.rejects(as(1, tx => invoke(tx, 'transaction', 20), 'authenticated', { ...claims(1), is_anonymous: true }), denied);
    await assert.rejects(as(3, tx => tx`DELETE FROM public.transactions WHERE id = ${id(20)}`), denied);
    await assert.rejects(as(1, tx => tx`DELETE FROM public.employees WHERE id = ${id(11)}`), denied);
    assert.equal((await sql`SELECT count(*)::int AS n FROM owner_delete_private.events`)[0].n, 0);
    console.log('PASS authorization: Owner role, current session, anonymous/employee RPC, raw DELETE');

    if (postgrest) {
      const apiPort = await freePort();
      const secret = randomBytes(48).toString('hex');
      const apiLog = fs.openSync(path.join(root, 'postgrest.log'), 'a');
      try {
        api = spawn(postgrest, [], {
          windowsHide: true, stdio: ['ignore', apiLog, apiLog],
          env: {
            SystemRoot: process.env.SystemRoot,
            PATH: [path.resolve(pgBin), process.env.PATH].join(path.delimiter),
            PGRST_DB_URI: `postgresql://authenticator@${loopback}:${port}/postgres`,
            PGRST_DB_SCHEMAS: 'public',
            PGRST_DB_ANON_ROLE: 'anon',
            PGRST_JWT_SECRET: secret,
            PGRST_SERVER_HOST: loopback,
            PGRST_SERVER_PORT: String(apiPort),
          },
        });
      } finally {
        fs.closeSync(apiLog);
      }
      const base = `http://${loopback}:${apiPort}`;
      let ready = false;
      for (let i = 0; i < 40 && !ready; i++) {
        ready = await fetch(base).then(response => response.ok).catch(() => false);
        if (!ready) await sleep(100);
      }
      assert.ok(ready, 'local PostgREST ready');
      const http = (kind, target, token) => fetch(base + '/rpc/owner_delete_demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ _kind: kind, _id: id(target), _confirmation: codes[kind](target), _demo_confirmed: true }),
      });
      for (const [kind, target] of [['employee', 11], ['transaction', 20]]) {
        assert.equal((await http(kind, target)).status, 401);
        assert.equal((await http(kind, target, jwt(claims(3), secret))).status, 403);
      }
      const accepted = await http('transaction', 21, jwt(claims(1), secret));
      assert.equal(accepted.status, 200);
      assert.equal(await accepted.json(), 'active_transaction');
      console.log('PASS direct HTTP: actual PostgREST refuses both targets for employee and anonymous');
    } else {
      console.log('NOT RUN direct HTTP: supply the local PostgREST executable');
    }

    assert.equal(await owner('employee', 11, 'b25emp-11'), 'confirmation');
    assert.equal(await owner('transaction', 20, 'BTRDTRX-20 '), 'confirmation');
    assert.equal(await owner('transaction', 20, codes.transaction(20), false), 'demo_required');
    assert.equal(await owner('employee', 10), 'protected_employee');
    assert.equal(await owner('employee', 12), 'protected_employee');
    assert.equal(await owner('employee', 13), 'open_cash');
    assert.equal(await owner('employee', 14), 'active_training');
    assert.equal(await owner('employee', 15), 'employee_history');
    assert.equal(await owner('employee', 16), 'employee_history');
    for (const target of [21, 22]) assert.equal(await owner('transaction', target), 'active_transaction');
    for (const target of [23, 24]) assert.equal(await owner('transaction', target), 'paid_transaction');
    for (const target of [25, 26, 27, 28, 29, 30, 33]) assert.equal(await owner('transaction', target), 'transaction_reference');
    console.log('PASS exact target and DEMO confirmation, Owner/self, OPEN/FINAL, Training, finance, receipts, Housekeeping, FK rollback');

    const before = (await sql`SELECT public.protected_snapshot() AS records`)[0].records;
    assert.deepEqual(await Promise.all([owner('transaction', 20), owner('transaction', 20)]), ['done', 'done']);
    assert.deepEqual(await Promise.all([owner('employee', 11), owner('employee', 11)]), ['done', 'done']);
    assert.equal(await owner('transaction', 20, 'WRONG'), 'confirmation');
    const [employee] = await sql`
      SELECT e.active, e.deleted_at IS NOT NULL AS archived, u.banned_until > now() AS banned,
        EXISTS (SELECT 1 FROM auth.sessions WHERE user_id = u.id) AS session,
        EXISTS (SELECT 1 FROM auth.refresh_tokens WHERE user_id = u.id::text AND NOT revoked) AS refreshable,
        EXISTS (SELECT 1 FROM user_roles WHERE user_id = u.id) AS role,
        e.photo_key
      FROM employees e JOIN auth.users u ON e.user_id = u.id WHERE e.id = ${id(11)}
    `;
    assert.deepEqual({ ...employee }, { active: false, archived: true, banned: true, session: false, refreshable: false, role: false, photo_key: 'fixture/photo' });
    await assert.rejects(sql`UPDATE employees SET active = true WHERE id = ${id(11)}`, denied);
    await assert.rejects(sql`INSERT INTO employees (user_id,employee_id) VALUES (${id(999)}, ${codes.employee(11)})`, { code: '23505' });
    await assert.rejects(sql`INSERT INTO finance_cash_sessions (opened_by,status) VALUES (${id(3)}, 'OPEN')`, denied);
    await assert.rejects(sql`INSERT INTO finance_training_assignments (trainee_user_id,supervisor_user_id,status) VALUES (${id(3)}, ${id(1)}, 'ACTIVE')`, denied);

    const [events] = await sql`SELECT count(*)::int AS count, bool_and(actor_uid = ${id(1)} AND reason = 'demo_cleanup' AND recorded_at <= now()) AS correct
      FROM owner_delete_private.events WHERE result = 'done'`;
    assert.deepEqual({ ...events }, { count: 2, correct: true });
    const [removed] = await sql`SELECT EXISTS(SELECT 1 FROM transactions WHERE id = ${id(20)}) AS present`;
    assert.equal(removed.present, false);
    assert.deepEqual((await sql`SELECT public.protected_snapshot() AS records`)[0].records, before);
    await assert.rejects(sql`UPDATE owner_delete_private.events SET reason = 'demo_cleanup'`, denied);
    await assert.rejects(sql`DELETE FROM owner_delete_private.events`, denied);
    await assert.rejects(sql`TRUNCATE owner_delete_private.events`, denied);
    await assert.rejects(as(1, tx => tx`SELECT * FROM owner_delete_private.events`), denied);
    await assert.rejects(sql`INSERT INTO transactions (id,transaction_number,status) VALUES (${id(999)}, ${codes.transaction(20)}, 'cancelled')`, { code: '23505' });
    console.log('PASS parallel retries, one success per target, durable audit, permanent IDs, unchanged protected records');

    // Hold an uncommitted FK write on a separate connection. The deletion must
    // wait, observe the committed payment and refuse to remove its parent.
    let release, inserted;
    const unblock = new Promise(resolve => { release = resolve; });
    const ready = new Promise(resolve => { inserted = resolve; });
    const writer = sql.begin(async tx => {
      await tx`INSERT INTO payments (transaction_id, cash_session_id, recorded_by) VALUES (${id(31)}, ${id(40)}, ${id(1)})`;
      inserted();
      await unblock;
    });
    await ready;
    const deleteAttempt = owner('transaction', 31);
    await sleep(120);
    release();
    await writer;
    assert.equal(await deleteAttempt, 'paid_transaction');
    console.log('PASS concurrent payment insert preserves parent and payment');
  } finally {
    if (api) api.kill();
    if (sql) await sql.end({ timeout: 3 });
    if (server && server.exitCode === null) {
      try {
        run('pg_ctl', ['-D', cluster, '-m', 'fast', '-w', 'stop']);
      } finally {
        server.kill();
      }
    }
    console.log(`Isolated fixture logs: ${root}`);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
