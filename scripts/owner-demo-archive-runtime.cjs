// Run only archive/revocation follow-up tests:
// node scripts/owner-delete-runtime-tests.cjs <pg-bin> --archive [gotrue-executable]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const migration = fs.readFileSync('supabase/pending/20261122000001_owner_demo_transaction_archive.sql', 'utf8');

module.exports = async function runArchive({ sql, as, id, connection, postgres, root, freePort, sleep, jwt, gotrue }) {
  await sql.unsafe(`
    ALTER TABLE transactions ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
    CREATE FUNCTION public.fixture_touch() RETURNS trigger LANGUAGE plpgsql AS
      $$ BEGIN NEW.updated_at := clock_timestamp(); RETURN NEW; END $$;
    CREATE TRIGGER touch_transactions BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION public.fixture_touch();
    ALTER TABLE payments ADD COLUMN amount int NOT NULL DEFAULT 100000, ADD COLUMN commission_amount int NOT NULL DEFAULT 5000;
    ALTER TABLE finance_cash_sessions ADD COLUMN closing_snapshot jsonb;
    UPDATE finance_cash_sessions SET closing_snapshot = '{"expected_cash":150000,"cash":150000}' WHERE status = 'FINAL';
    UPDATE payments SET cash_session_id = fixture_id(41) WHERE transaction_id = fixture_id(23);
    INSERT INTO finance_refunds VALUES (fixture_id(23));
    INSERT INTO payment_receipts VALUES (fixture_id(23));
    INSERT INTO housekeeping_jobs VALUES (fixture_id(23));
    INSERT INTO housekeeping_history VALUES (fixture_id(23), 'approved');
    INSERT INTO housekeeping_checklists VALUES (fixture_id(23), 'evidence');
    GRANT UPDATE ON transactions TO authenticated;
  `);
  await sql.begin(tx => tx.unsafe(migration.replace(/^BEGIN;|COMMIT;$/gm, '')));
  const archive = (n, code = `BTRDTRX-${n}`, actor = 1, role = 'authenticated') =>
    as(actor, async tx => (await tx`SELECT owner_archive_demo(${id(n)}, ${code}) AS result`)[0].result, role);
  const approve = (n, number = `BTRDTRX-${n}`) =>
    sql`SELECT owner_delete_private.approve_demo_transaction(${id(n)}, ${number}, 'FIXTURE-APPROVED')`;

  assert.equal(await archive(23), 'demo_unclassified');
  assert.equal(await archive(24), 'demo_unclassified');
  await assert.rejects(approve(23, 'wrong'), { code: '22023' });
  await assert.rejects(as(1, tx => tx`SELECT owner_delete_private.approve_demo_transaction(${id(24)}, 'BTRDTRX-24', 'fake')`), { code: '42501' });
  for (const n of [20, 21, 22, 23]) await approve(n);
  assert.equal(await archive(20), 'unpaid_transaction');
  assert.equal(await archive(21), 'active_transaction');
  assert.equal(await archive(22), 'active_transaction');
  assert.equal(await archive(23, 'BTRDTRX-23 '), 'confirmation');
  await assert.rejects(archive(23, 'BTRDTRX-23', 3), { code: '42501' });
  await assert.rejects(archive(23, 'BTRDTRX-23', 3, 'anon'), { code: '42501' });
  await assert.rejects(as(1, tx => tx`UPDATE transactions SET demo_archived_at = now(), demo_archived_by = ${id(1)} WHERE id = ${id(24)}`), { code: '42501' });
  assert.equal((await sql`SELECT count(*)::int AS n FROM transactions WHERE demo_archived_at IS NOT NULL`)[0].n, 0);

  async function snapshot() {
    const [row] = await sql`SELECT protected_snapshot() AS records,
      (SELECT sum(amount)::int FROM payments) AS penerimaan,
      (SELECT sum(commission_amount)::int FROM payments) AS komisi,
      (SELECT count(*)::int FROM transactions) AS jumlah_historis`;
    row.records.transactions = row.records.transactions.map(trx => {
      const { demo_archived_at, demo_archived_by, ...original } = trx;
      return original;
    });
    return { ...row };
  }
  const before = await snapshot();
  assert.deepEqual(await Promise.all([archive(23), archive(23)]), ['done', 'done']);
  assert.deepEqual(await snapshot(), before);
  const [audit] = await sql`SELECT count(*)::int AS n, bool_and(actor_uid = ${id(1)}) AS valid
    FROM owner_delete_private.events WHERE action = 'archive_transaction' AND result = 'done'`;
  assert.deepEqual({ ...audit }, { n: 1, valid: true });
  const [trx] = await sql`SELECT t.transaction_number, t.demo_archived_by, t.demo_archived_at
    FROM payments p JOIN transactions t ON t.id = p.transaction_id WHERE t.id = ${id(23)}`;
  assert.equal(trx.transaction_number, 'BTRDTRX-23');
  assert.equal(trx.demo_archived_by, id(1));
  assert.ok(trx.demo_archived_at);
  await assert.rejects(sql`UPDATE transactions SET demo_archived_at = NULL, demo_archived_by = NULL WHERE id = ${id(23)}`, { code: '42501' });
  await assert.rejects(sql`UPDATE transactions SET status = 'check_in' WHERE id = ${id(23)}`, { code: '42501' });
  assert.equal((await sql`SELECT count(*)::int AS n FROM transactions WHERE demo_archived_at IS NULL`)[0].n, before.jumlah_historis - 1);
  assert.equal((await as(1, tx => tx`SELECT owner_delete_demo('transaction', ${id(23)}, 'BTRDTRX-23', true) AS result`))[0].result, 'paid_transaction');
  console.log('PASS archive guards, exact ID, no-op on denial, parallel retry, metadata-only diff, fiscal and HK snapshots, historic finance relation, permanent guard');

  if (!gotrue) {
    console.log('NOT RUN GoTrue provider: pass an isolated local GoTrue executable');
    return;
  }
  await sql`CREATE DATABASE archive_auth_fixture`;
  const authDb = postgres({ ...connection, database: 'archive_auth_fixture', max: 1 });
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const secret = randomBytes(48).toString('hex');
  const log = fs.openSync(path.join(root, 'gotrue.log'), 'a');
  let server;
  try {
    await authDb`CREATE SCHEMA auth`;
    server = spawn(gotrue, [], { windowsHide: true, stdio: ['ignore', log, log], env: {
      SystemRoot: process.env.SystemRoot, PATH: process.env.PATH,
      API_EXTERNAL_URL: base, GOTRUE_API_HOST: '127.0.0.1', GOTRUE_API_PORT: String(port),
      GOTRUE_DB_DRIVER: 'postgres', DB_NAMESPACE: 'auth',
      GOTRUE_DB_DATABASE_URL: `postgresql://postgres@127.0.0.1:${connection.port}/archive_auth_fixture?sslmode=disable&search_path=auth`,
      GOTRUE_SITE_URL: base, GOTRUE_JWT_SECRET: secret, GOTRUE_JWT_ADMIN_ROLES: 'service_role',
      GOTRUE_MAILER_AUTOCONFIRM: 'true', GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true',
    } });
    let ready = false;
    for (let i = 0; i < 70 && !ready; i++) {
      ready = await fetch(base + '/health').then(r => r.ok).catch(() => false);
      if (!ready) await sleep(100);
    }
    assert.ok(ready, 'GoTrue ready; see gotrue.log');
    const admin = jwt({ role: 'service_role', exp: Math.floor(Date.now() / 1000) + 300 }, secret);
    const post = async (resource, body, token) => fetch(base + resource, {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
    const credentials = label => ({ email: `${label}@fixture.example`, password: randomBytes(24).toString('hex') });
    async function account(label) {
      const creds = credentials(label);
      const created = await post('/admin/users', { ...creds, email_confirm: true }, admin);
      assert.ok(created.ok, `GoTrue create fixture ${created.status}`);
      const login = await post('/token?grant_type=password', creds);
      assert.ok(login.ok, `GoTrue password login ${login.status}`);
      return { creds, tokens: await login.json() };
    }
    const owner = await account('owner');
    const staff = await account('staff');
    const unrelated = await account('other');
    const fixture = fs.readFileSync('scripts/fixtures/owner-delete.sql', 'utf8');
    await authDb.unsafe(fixture.slice(fixture.indexOf('CREATE FUNCTION public.fixture_id'), fixture.indexOf('CREATE TABLE auth.users'))
      + fixture.slice(fixture.indexOf('CREATE TYPE public.app_role'), fixture.indexOf('INSERT INTO auth.users')));
    await authDb.unsafe(fs.readFileSync('supabase/pending/20261122000000_owner_delete.sql', 'utf8'));
    await authDb`INSERT INTO user_roles (user_id, role) VALUES (${owner.tokens.user.id}, 'owner'), (${staff.tokens.user.id}, 'employee')`;
    const [employee] = await authDb`INSERT INTO employees (user_id, employee_id) VALUES (${staff.tokens.user.id}, 'B25EMP-FIXTURE') RETURNING id`;
    const claims = JSON.parse(Buffer.from(owner.tokens.access_token.split('.')[1], 'base64url'));
    const result = await authDb.begin(async tx => {
      await tx.unsafe('SET LOCAL ROLE authenticated');
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
      return tx`SELECT owner_delete_demo('employee', ${employee.id}, 'B25EMP-FIXTURE', true) AS result`;
    });
    assert.equal(result[0].result, 'done');
    const [state] = await authDb`SELECT banned_until > now() AS banned,
      (SELECT count(*)::int FROM auth.sessions WHERE user_id = u.id) AS sessions
      FROM auth.users u WHERE u.id = ${staff.tokens.user.id}`;
    assert.deepEqual({ ...state }, { banned: true, sessions: 0 });
    assert.equal((await post('/token?grant_type=password', staff.creds)).ok, false);
    assert.equal((await post('/token?grant_type=refresh_token', { refresh_token: staff.tokens.refresh_token })).ok, false);
    assert.equal((await post('/token?grant_type=refresh_token', { refresh_token: unrelated.tokens.refresh_token })).ok, true);
    console.log('PASS real GoTrue fixture login, DB archive, removed session, denied target login and refresh, unrelated refresh works');
  } finally {
    fs.closeSync(log);
    if (server) server.kill();
    await authDb.end();
  }
};
