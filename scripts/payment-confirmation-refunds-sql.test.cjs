// In-memory PostgreSQL only. Never accepts a database URL or uses Supabase/Cloud.
// Install @electric-sql/pglite@0.3.14 in TEMP/BTRD25-pdf-db-test; no project dependency.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { PGlite } = require(path.join(os.tmpdir(), 'BTRD25-pdf-db-test/node_modules/@electric-sql/pglite'));
const migration = fs.readFileSync('supabase/pending/20261112175446_payment_confirmation_refunds.sql', 'utf8');
const uid = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
function existingFunction(file, name, terminator) {
  const text = fs.readFileSync(file, 'utf8');
  const start = text.toLowerCase().indexOf('create or replace function public.' + name + '(');
  assert.ok(start >= 0, name);
  const end = text.indexOf(terminator, start);
  return text.slice(start, end + terminator.length);
}
test('local PostgreSQL: role/Training/transaction authorization, RLS isolation, complete projection and revision', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      CREATE TYPE public.app_role AS ENUM ('owner','employee');
      CREATE TYPE public.employee_position AS ENUM ('supervisor','receptionist','housekeeping','inspector','investor');
      CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
      CREATE TABLE public.employees(user_id uuid, active boolean, position public.employee_position);
      CREATE TABLE public.finance_training_assignments(trainee_user_id uuid,status text,starts_on date,created_at timestamptz);
      CREATE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
        $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
      -- Models a valid assisted session. The real restricted-training guard must override it.
      CREATE FUNCTION public.finance_training_context_valid(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
      CREATE TABLE public.transactions(id uuid PRIMARY KEY, updated_at timestamptz, created_by uuid);
      CREATE TABLE public.payments(id uuid PRIMARY KEY,transaction_id uuid,amount numeric,created_at timestamptz,kind text,method text);
      CREATE TABLE public.finance_refunds(id uuid PRIMARY KEY,transaction_id uuid,amount numeric,created_at timestamptz,refund_method text,created_by uuid,reason text);
      GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
      GRANT SELECT ON public.transactions,public.finance_refunds TO authenticated;
      ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.finance_refunds ENABLE ROW LEVEL SECURITY;
    `);
    await db.exec(existingFunction('supabase/migrations/20261003000011_role_permission_foundation.sql','has_employee_position','$$;'));
    await db.exec(existingFunction('supabase/migrations/20261018000000_finance_training_enforcement.sql','finance_training_is_restricted','$function$;'));
    await db.exec(existingFunction('supabase/migrations/20261018000000_finance_training_enforcement.sql','is_receptionist','$function$;'));
    await db.exec(`
      CREATE POLICY transactions_read ON public.transactions FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'owner') OR public.is_receptionist(auth.uid()));
      CREATE POLICY transactions_supervisor_read ON public.transactions FOR SELECT TO authenticated USING(public.has_employee_position(auth.uid(),ARRAY['supervisor']::public.employee_position[]));
      CREATE POLICY finance_refunds_read ON public.finance_refunds FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'owner') OR created_by=auth.uid());
      INSERT INTO public.user_roles VALUES ('${uid(1)}','owner');
      INSERT INTO public.user_roles SELECT ('00000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid,'employee' FROM generate_series(2,8) i;
      INSERT INTO public.employees VALUES ('${uid(2)}',true,'supervisor'),('${uid(3)}',true,'receptionist'),
        ('${uid(4)}',false,'receptionist'),('${uid(5)}',true,'housekeeping'),('${uid(6)}',true,'inspector'),
        ('${uid(7)}',true,'investor'),('${uid(8)}',true,'receptionist');
      INSERT INTO public.finance_training_assignments VALUES ('${uid(8)}','ACTIVE',current_date,now());
      INSERT INTO public.transactions VALUES ('${uid(91)}',now(),'${uid(1)}'),('${uid(92)}',now(),'${uid(1)}');
      INSERT INTO public.payments VALUES ('${uid(201)}','${uid(91)}',100000,now(),'payment','QRIS');
      INSERT INTO public.finance_refunds VALUES ('${uid(101)}','${uid(91)}',5000,'2026-11-13T00:00:00Z','QRIS','${uid(1)}','private reason'),
        ('${uid(102)}','${uid(91)}',1000,'2026-11-13T00:00:00Z','CASH','${uid(1)}','private reason'),
        ('${uid(103)}','${uid(92)}',9999,now(),'CASH','${uid(1)}','other transaction');
    `);
    const policiesBefore = (await db.query("SELECT policyname,qual FROM pg_policies WHERE tablename='finance_refunds'")).rows;
    await db.exec(migration); // Applied only to this fresh in-memory database.
    assert.deepEqual((await db.query("SELECT policyname,qual FROM pg_policies WHERE tablename='finance_refunds'")).rows, policiesBefore);
    async function asActor(actor, tx = uid(91), role = 'authenticated') {
      await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${actor ?? ''}',false); SET ROLE ${role};`);
      return (await db.query('SELECT public.read_payment_confirmation_refunds($1::uuid) AS result',[tx])).rows[0].result;
    }
    for (const actor of [uid(1),uid(2),uid(3)]) {
      const value = await asActor(actor);
      assert.equal(value.complete,true); assert.equal(value.refund_count,2); assert.equal(value.actor_id,actor);
      assert.deepEqual(value.refunds.map(r=>r.id),[uid(101),uid(102)]);
      assert.deepEqual(Object.keys(value.refunds[0]).sort(),['id','transaction_id','amount','created_at','refund_method'].sort());
      assert.ok(value.refunds.every(r=>r.transaction_id===uid(91)));
    }
    const first = await asActor(uid(3));
    assert.equal((await db.query('SELECT * FROM public.finance_refunds')).rows.length,0); // Direct RLS unchanged.
    assert.equal((await asActor(uid(3),uid(92))).refund_count,1); // Not restricted to creator or shift.
    for (const actor of [null,uid(4),uid(5),uid(6),uid(7),uid(8),uid(9)]) {
      await assert.rejects(()=>asActor(actor), e=>e.code==='42501');
    }
    await assert.rejects(()=>asActor(uid(3),uid(93)),e=>e.code==='42501');
    await assert.rejects(()=>asActor(null,uid(91),'anon'),e=>e.code==='42501');
    await db.exec('RESET ROLE');
    const payments = (await db.query('SELECT * FROM public.payments ORDER BY created_at,id')).rows;
    const digest = require('node:crypto').createHash('sha256').update(JSON.stringify(payments.map(p=>[p.id,p.transaction_id,
      String(Math.round(Number(p.amount)*100)),new Date(p.created_at).toISOString(),p.kind,p.method]))).digest('hex');
    assert.equal(first.payment_count,payments.length); assert.equal(first.payment_digest,digest);
    for (const status of ['FAILED','REVOKED']) {
      await db.exec(`UPDATE public.finance_training_assignments SET status='${status}';`);
      await assert.rejects(()=>asActor(uid(8)),e=>e.code==='42501');
      await db.exec('RESET ROLE');
    }
    await db.exec("UPDATE public.finance_training_assignments SET status='PASSED';");
    assert.equal((await asActor(uid(8))).complete,true);
    await db.exec('RESET ROLE');
    await db.exec(`INSERT INTO public.transactions VALUES ('${uid(94)}',now(),'${uid(1)}');`);
    const empty = await asActor(uid(3),uid(94));
    assert.equal(empty.complete,true); assert.equal(empty.refund_count,0); assert.deepEqual(empty.refunds,[]);
    await db.exec('RESET ROLE');
    await db.exec(`UPDATE public.payments SET amount=99999 WHERE id='${uid(201)}';`);
    assert.notEqual((await asActor(uid(3))).ledger_revision,first.ledger_revision);
    await db.exec('RESET ROLE');
    await db.exec(`INSERT INTO public.finance_refunds SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'${uid(91)}',1,now(),'CASH','${uid(1)}','hidden' FROM generate_series(1000,1204) i;`);
    const many = await asActor(uid(2));
    assert.equal(many.refund_count,207); assert.equal(many.refunds.length,207);
    await db.exec('RESET ROLE');
    const metadata = (await db.query("SELECT p.prosecdef,p.provolatile,p.proconfig,pg_get_userbyid(p.proowner) AS owner,has_function_privilege('anon',p.oid,'EXECUTE') AS anon,has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated FROM pg_proc p WHERE p.oid='public.read_payment_confirmation_refunds(uuid)'::regprocedure")).rows[0];
    assert.equal(metadata.prosecdef,true); assert.equal(metadata.provolatile,'s'); assert.equal(metadata.owner,'postgres');
    assert.equal(metadata.anon,false); assert.equal(metadata.authenticated,true);
    assert.equal((await db.query("SELECT has_function_privilege('service_role','public.read_payment_confirmation_refunds(uuid)','EXECUTE') AS allowed")).rows[0].allowed,false);
    assert.ok(metadata.proconfig.some(v=>v.startsWith('search_path=')));
  } finally { await db.close(); }
});
