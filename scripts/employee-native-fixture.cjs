// Synthetic prerequisite schema only. Exact pending SQL is loaded separately.
// No Auth server, SMTP, Cloud connection, real credentials or personal records.
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const snapshots=[
 ['67','b4a486c747202031e52a06a5cf9d67126fc83654','supabase/pending/20261113233800_private_employee_profiles.sql'],
 ['68','b9460e98e56ea0a58da828f2208a468e8cdb09af','supabase/pending/20261113170814_employee_lifecycle_audit.sql'],
 ['69','a8acfcf548bcba11111361f0b4e03ef82dd69c38','supabase/pending/20261113174830_secure_employee_provisioning.sql'],
 ['70','98e87d1e86803bb0d77c5aaf0a67ac846bb082ea','supabase/pending/20261113202919_employee_email_delivery_contract.sql'],
].map(([pr,sha,path])=>{const sql=cp.execFileSync('git',['show',`${sha}:${path}`],{encoding:'utf8'});return {pr,sha,path,sql,digest:crypto.createHash('sha256').update(sql).digest('hex')};});
const read=p=>fs.readFileSync(p,'utf8');
function fn(sql,name){const m=sql.match(new RegExp(`create(?: or replace)? function public\\.${name}\\([\\s\\S]*?(?:\\$function\\$|\\$\\$);`,'i'));if(!m)throw Error('FIXTURE_HELPER_MISSING');return m[0];}
async function bootstrap(q){
 await q(`CREATE SCHEMA auth;CREATE SCHEMA storage;CREATE SCHEMA rehearsal;
 CREATE TABLE rehearsal.ledger(ordinal int PRIMARY KEY,pr text UNIQUE,source_sha text,sql_sha256 text,object_owner text);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
 CREATE TYPE app_role AS ENUM('owner','employee');CREATE TYPE employee_position AS ENUM('receptionist','supervisor','housekeeping','inspector','investor');
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text UNIQUE,created_at timestamptz DEFAULT now(),raw_app_meta_data jsonb DEFAULT '{}',banned_until timestamptz);
 CREATE TABLE user_roles(user_id uuid PRIMARY KEY,role app_role);
 CREATE TABLE employees(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid UNIQUE,name text,employee_id text UNIQUE,position employee_position,active boolean DEFAULT true,created_at timestamptz DEFAULT now());
 CREATE TABLE finance_cash_sessions(id uuid PRIMARY KEY,opened_by uuid,status text,opened_at timestamptz DEFAULT now());
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text UNIQUE);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT USAGE ON SCHEMA auth,storage TO authenticated,anon;
 GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
 GRANT SELECT,INSERT,UPDATE ON employees TO authenticated;
 GRANT SELECT,UPDATE ON finance_cash_sessions TO authenticated;`);
 await q(fn(read('drizzle/migrations/0000_operational_foundation.sql'),'has_role'));
 const roles=read('supabase/migrations/20261003000011_role_permission_foundation.sql');
 for(const n of ['has_employee_position','can_operate'])await q(fn(roles,n));
 const training=read('supabase/migrations/20261018000000_finance_training_enforcement.sql');
 await q(training.slice(training.indexOf('CREATE TABLE IF NOT EXISTS public.finance_training_assignments'),training.indexOf('CREATE TABLE IF NOT EXISTS public.finance_training_audit')));
 for(const n of ['finance_training_assignment_for','finance_training_is_restricted','finance_training_session_is_valid','finance_training_context_assignment','finance_training_context_valid','finance_training_current_user_is_restricted','create_finance_training_assignment','resolve_finance_training_assignment','is_receptionist','can_frontdesk','finance_is_owner_or_supervisor','finance_is_booking_operator','finance_training_session_guard'])await q(fn(training,n));
 await q(`REVOKE ALL ON FUNCTION finance_training_is_restricted(uuid),finance_training_context_valid(uuid),finance_training_session_is_valid(uuid,uuid) FROM PUBLIC,authenticated;
 ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
 CREATE POLICY fixture_employee_owner ON employees FOR ALL TO authenticated USING(has_role(auth.uid(),'owner')) WITH CHECK(has_role(auth.uid(),'owner'));
 CREATE TRIGGER fixture_cash_guard BEFORE INSERT OR UPDATE OR DELETE ON finance_cash_sessions FOR EACH ROW EXECUTE FUNCTION finance_training_session_guard();`);
 for(const n of [1,2,3,4,5,6,7,20]){
  await q('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id(n),`native-fixture-${n}@example.invalid`]);
  await q('INSERT INTO user_roles VALUES($1,$2)',[id(n),[1,7].includes(n)?'owner':'employee']);
  if(![1,7].includes(n))await q("INSERT INTO employees(id,user_id,name,employee_id,position,active) VALUES($1,$1,'Synthetic',$2,$3,$4)",[id(n),n===20?'B25EMP-001':`LEGACY-${n}`,n===2?'supervisor':'receptionist',n!==6]);
 }
 await q("SELECT set_config('test.actor',$1,false)",[id(1)]);
 await q("INSERT INTO finance_training_assignments(trainee_user_id,supervisor_user_id,starts_on,ends_on,created_by) VALUES($1,$2,(now() AT TIME ZONE 'Asia/Jakarta')::date,(now() AT TIME ZONE 'Asia/Jakarta')::date+1,$3)",[id(4),id(2),id(1)]);
 await q("INSERT INTO finance_cash_sessions(id,opened_by,status) VALUES($1,$2,'OPEN')",[id(10),id(2)]);
}
module.exports={id,snapshots,bootstrap};
