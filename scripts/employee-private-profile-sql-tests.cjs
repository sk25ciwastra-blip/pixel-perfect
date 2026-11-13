// Full pending SQL in isolated PostgreSQL/PGlite. No network DB, JWT or real identity.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { PGlite } = require(process.env.BTRD25_PGLITE_MODULE || path.join(os.tmpdir(),'BTRD25-pdf-db-test/node_modules/@electric-sql/pglite'));
const sql = fs.readFileSync('supabase/pending/20261113233800_private_employee_profiles.sql','utf8');
const uuid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const bucket='employee-portraits';
assert.equal((sql.match(/^BEGIN;/gm)||[]).length,1);
assert.equal((sql.match(/^COMMIT;/gm)||[]).length,1);
assert.equal((sql.match(/CREATE TABLE public.employee_private_profiles/g)||[]).length,1);
assert.doesNotMatch(sql,/GRANT.*EXECUTE.*finance_training_is_restricted/i);
const parseFunction=(source,name)=>{
  const m=source.match(new RegExp(`CREATE(?: OR REPLACE)? FUNCTION public\\.${name}\\([\\s\\S]*?(?:\\$function\\$|\\$\\$);`,'i'));
  assert.ok(m,`missing baseline ${name}`);return m[0];
};
async function fixture(){
  const db=new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TYPE app_role AS ENUM ('owner','employee');
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE employees(id uuid PRIMARY KEY,name text);
    CREATE TABLE user_roles(user_id uuid,role app_role);
    CREATE TABLE finance_training_assignments(trainee_user_id uuid,status text,starts_on date,created_at timestamptz DEFAULT now());
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA auth,storage TO authenticated,anon;
    GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,anon;
    -- Models a permissive pre-existing policy; the pending SQL must still protect its bucket.
    CREATE POLICY fixture_existing_broad_storage ON storage.objects FOR ALL TO authenticated,anon USING(true) WITH CHECK(true);`);
  await db.exec(parseFunction(fs.readFileSync('drizzle/migrations/0000_operational_foundation.sql','utf8'),'has_role'));
  await db.exec(parseFunction(fs.readFileSync('supabase/migrations/20261018000000_finance_training_enforcement.sql','utf8'),'finance_training_is_restricted'));
  await db.exec(`REVOKE ALL ON FUNCTION public.has_role(uuid,app_role) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.has_role(uuid,app_role) TO authenticated;
    REVOKE ALL ON FUNCTION public.finance_training_is_restricted(uuid) FROM PUBLIC,anon,authenticated;`);
  for(const n of [1,2,3,4,5,6]){
    await db.query('INSERT INTO auth.users VALUES($1)',[uuid(n)]);
    await db.query('INSERT INTO user_roles VALUES($1,$2)',[uuid(n),n===1||n===5?'owner':'employee']);
  }
  for(const n of [20,21,22]) await db.query('INSERT INTO employees VALUES($1,\'Fixture\')',[uuid(n)]);
  for(const n of [4,5]) await db.query('INSERT INTO finance_training_assignments VALUES($1,\'ACTIVE\',current_date,now())',[uuid(n)]);
  return db;
}
const denied=promise=>assert.rejects(promise,e=>e.code==='42501');
async function installAndRoles(existingBucket=false){
  const db=await fixture();
  try{
    if(existingBucket) await db.query('INSERT INTO storage.buckets VALUES($1,$1,false,2097152,$2)',[bucket,['image/webp','image/jpeg','image/png']]);
    const before=JSON.stringify((await db.query('SELECT * FROM employees ORDER BY id')).rows);
    const acl=(await db.query("SELECT proacl::text acl FROM pg_proc WHERE oid='public.finance_training_is_restricted(uuid)'::regprocedure")).rows[0].acl;
    // Execute COMPLETE SQL, including bucket creation/check and all policies/COMMIT.
    await db.exec(sql);
    assert.equal(JSON.stringify((await db.query('SELECT * FROM employees ORDER BY id')).rows),before);
    assert.equal((await db.query("SELECT proacl::text acl FROM pg_proc WHERE oid='public.finance_training_is_restricted(uuid)'::regprocedure")).rows[0].acl,acl);
    assert.equal((await db.query("SELECT has_function_privilege('authenticated','public.finance_training_is_restricted(uuid)','EXECUTE') allowed")).rows[0].allowed,false);
    const wrapper=(await db.query("SELECT prosecdef,proconfig FROM pg_proc WHERE oid='public.can_manage_employee_private_profile()'::regprocedure")).rows[0];
    assert.equal(wrapper.prosecdef,true);assert.ok(wrapper.proconfig.includes('search_path=""'));
    const b=(await db.query('SELECT * FROM storage.buckets WHERE id=$1',[bucket])).rows[0];
    assert.equal(b.public,false);assert.equal(Number(b.file_size_limit),2097152);
    assert.deepEqual([...b.allowed_mime_types].sort(),['image/jpeg','image/png','image/webp']);
    await db.exec("INSERT INTO storage.buckets VALUES('fixture-other','fixture-other',false,NULL,NULL); INSERT INTO storage.objects(bucket_id,name) VALUES('fixture-other','fixture');");
    const actor=async n=>db.query("SELECT set_config('test.actor',$1,false)",[n?uuid(n):'']);
    const insertProfile=(employee,n=0,updatedBy=1)=>db.query(`INSERT INTO employee_private_profiles(employee_id,nik,phone,emergency_contact_name,emergency_contact_relationship,emergency_contact_phone,updated_by)
      VALUES($1,$2,repeat('0',9),'Fixture','Fixture',repeat('0',9),$3)`,[uuid(employee),String(n).padStart(16,'0'),uuid(updatedBy)]);
    await actor(1);await db.exec('SET ROLE authenticated');
    assert.equal((await db.query('SELECT can_manage_employee_private_profile() allowed')).rows[0].allowed,true);
    await denied(db.query('SELECT finance_training_is_restricted($1)',[uuid(1)]));
    await insertProfile(20);
    assert.equal((await db.query('SELECT count(*)::int n FROM employee_private_profiles')).rows[0].n,1);
    await db.query("UPDATE employee_private_profiles SET emergency_contact_name='Fixture updated',updated_by=$1 WHERE employee_id=$2",[uuid(1),uuid(20)]);
    await denied(db.query('UPDATE employee_private_profiles SET updated_by=$1',[uuid(2)]));
    await denied(insertProfile(21,1,2));
    await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,\'fixture-face.png\')',[bucket]);
    assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects WHERE bucket_id=$1',[bucket])).rows[0].n,1);
    assert.equal((await db.query('UPDATE storage.objects SET name=\'fixture-face-updated.png\' WHERE bucket_id=$1 RETURNING id',[bucket])).rows.length,1);
    await denied(db.exec('DELETE FROM employee_private_profiles'));
    for(const [n,label] of [[2,'Supervisor'],[3,'Receptionist'],[4,'Training'],[5,'Owner-role Training'],[6,'non-Owner']]){
      await actor(n);
      assert.equal((await db.query('SELECT can_manage_employee_private_profile() allowed')).rows[0].allowed,false);
      assert.equal((await db.query('SELECT count(*)::int n FROM employee_private_profiles')).rows[0].n,0);
      await denied(insertProfile(21,n,n));
      assert.equal((await db.query('UPDATE employee_private_profiles SET phone=repeat(\'1\',9) RETURNING employee_id')).rows.length,0);
      assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects WHERE bucket_id=$1',[bucket])).rows[0].n,0);
      await denied(db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,\'denied-face.png\')',[bucket]));
      assert.equal((await db.query('UPDATE storage.objects SET name=\'denied\' WHERE bucket_id=$1 RETURNING id',[bucket])).rows.length,0);
      assert.equal((await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 RETURNING id',[bucket])).rows.length,0);
      assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects WHERE bucket_id=\'fixture-other\'')).rows[0].n,1);
      if(!existingBucket) console.log(`PASS ${label}: profile/photo DENY, even with broad pre-existing Storage policy`);
    }
    await actor(null);
    assert.equal((await db.query('SELECT can_manage_employee_private_profile() allowed')).rows[0].allowed,false);
    assert.equal((await db.query('SELECT count(*)::int n FROM employee_private_profiles')).rows[0].n,0);
    await denied(insertProfile(21,9));
    await db.exec('RESET ROLE; SET ROLE anon');
    await denied(db.query('SELECT can_manage_employee_private_profile()'));
    await denied(db.query('SELECT * FROM employee_private_profiles'));
    await denied(insertProfile(21,8));
    assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects WHERE bucket_id=$1',[bucket])).rows[0].n,0);
    await denied(db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,\'denied-face.png\')',[bucket]));
    assert.equal((await db.query('UPDATE storage.objects SET name=\'denied\' WHERE bucket_id=$1 RETURNING id',[bucket])).rows.length,0);
    assert.equal((await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 RETURNING id',[bucket])).rows.length,0);
    await db.exec('RESET ROLE');
    const columns=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='employee_private_profiles'")).rows.map(x=>x.column_name);
    assert.deepEqual(columns.filter(c=>/photo|image|portrait|document|ktp/i.test(c)),['portrait_path']);
    assert.deepEqual((await db.query("SELECT id FROM storage.buckets WHERE id<>'fixture-other'")).rows.map(x=>x.id),[bucket]);
    assert.equal((await db.query('SELECT count(*)::int n FROM employee_private_profiles')).rows[0].n,1);
    console.log(`PASS full SQL ${existingBucket?'matching existing':'new'} bucket; Owner read/insert/update, anon DENY, helper ACL unchanged, legacy rows unchanged, face-portrait-only schema`);
  }finally{await db.close();}
}
async function collision(overrides,label){
  const db=await fixture();
  try{
    const b={name:bucket,public:false,limit:2097152,mimes:['image/jpeg','image/png','image/webp'],...overrides};
    await db.query('INSERT INTO storage.buckets VALUES($1,$2,$3,$4,$5)',[bucket,b.name,b.public,b.limit,b.mimes]);
    const before=JSON.stringify((await db.query('SELECT * FROM storage.buckets')).rows);
    await assert.rejects(db.exec(sql),/Bucket pas foto existing/);
    await db.exec('ROLLBACK');
    assert.equal(JSON.stringify((await db.query('SELECT * FROM storage.buckets')).rows),before);
    assert.equal((await db.query("SELECT to_regclass('public.employee_private_profiles') missing")).rows[0].missing,null);
    assert.equal((await db.query("SELECT to_regprocedure('public.can_manage_employee_private_profile()') missing")).rows[0].missing,null);
    console.log(`PASS ${label} collision: fail closed and entire migration rollback`);
  }finally{await db.close();}
}
(async()=>{
  await installAndRoles();await installAndRoles(true);
  for(const [data,label] of [[{public:true},'public bucket'],[{limit:null},'missing size limit'],[{limit:4194304},'oversized limit'],[{mimes:null},'unrestricted MIME'],[{mimes:['image/jpeg','image/png','application/pdf']},'document MIME'],[{name:'unexpected'},'name mismatch']]) await collision(data,label);
  const db=await fixture();
  try{
    await db.exec('CREATE TABLE public.employee_private_profiles(marker text); INSERT INTO public.employee_private_profiles VALUES(\'fixture\')');
    await assert.rejects(db.exec(sql),e=>e.code==='42P07');await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT count(*)::int n FROM employee_private_profiles')).rows[0].n,1);
    assert.equal((await db.query("SELECT to_regprocedure('public.can_manage_employee_private_profile()') missing")).rows[0].missing,null);
    console.log('PASS unknown profile table collision: rollback, existing schema/rows unchanged');
  }finally{await db.close();}
  console.log('PASS private bucket configuration is 2MiB JPEG/PNG/WebP; actual Storage HTTP/image byte verification NOT REACHED');
})().catch(e=>{console.error(`FAIL isolated SQL tests: ${e.code||e.name}`);process.exitCode=1;});
