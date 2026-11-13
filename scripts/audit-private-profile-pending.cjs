// Read-only Git snapshot + isolated PostgreSQL audit. Does NOT modify PR #67.
// Known failing dependency audit, intentionally exits 1 until that PR is repaired.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { PGlite } = require(process.env.BTRD25_PGLITE_MODULE || path.join(os.tmpdir(),'BTRD25-pdf-db-test/node_modules/@electric-sql/pglite'));
const sourceCommit = '0a884ed10cd9c18cd4a75b72c2abe5b834966fe0';
const source = execFileSync('git',['show',`${sourceCommit}:supabase/pending/20261113233800_private_employee_profiles.sql`],{encoding:'utf8'});
(async()=>{
  const db = new PGlite(); const findings=[];
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE TYPE app_role AS ENUM ('owner','employee');
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE TABLE employees(id uuid PRIMARY KEY);
      CREATE TABLE user_roles(user_id uuid,role app_role);
      CREATE TABLE finance_training_assignments(trainee_user_id uuid,status text,starts_on date,created_at timestamptz);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid,bucket_id text);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA auth,storage TO authenticated;
      GRANT SELECT,INSERT,UPDATE ON storage.objects TO authenticated;`);
    const base=fs.readFileSync('drizzle/migrations/0000_operational_foundation.sql','utf8');
    await db.exec(base.match(/CREATE FUNCTION public\.has_role\([\s\S]*?\$\$;/)[0]);
    const training=fs.readFileSync('supabase/migrations/20261018000000_finance_training_enforcement.sql','utf8');
    const start=training.indexOf('CREATE OR REPLACE FUNCTION public.finance_training_is_restricted(');
    await db.exec(training.slice(start,training.indexOf('$function$;',start)+'$function$;'.length));
    await db.exec('REVOKE ALL ON FUNCTION finance_training_is_restricted(uuid) FROM PUBLIC,authenticated;');
    try {await db.exec(source); findings.push('UNEXPECTED: complete SQL installed');}
    catch(e){ findings.push(`FAIL original PR67 SQL parse/install: SQLSTATE ${e.code}`); }
    await db.exec('ROLLBACK');
    // Inspect the intended first transaction separately; this is not a repaired migration.
    await db.exec(source.slice(0,source.indexOf('COMMIT;')+'COMMIT;'.length));
    await db.exec(`INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001');
      INSERT INTO employees VALUES ('00000000-0000-0000-0000-000000000002');
      INSERT INTO user_roles VALUES ('00000000-0000-0000-0000-000000000001','owner');
      INSERT INTO employee_private_profiles(employee_id,nik,phone,emergency_contact_name,emergency_contact_relationship,emergency_contact_phone,updated_by)
      VALUES ('00000000-0000-0000-0000-000000000002',repeat('0',16),repeat('0',9),'Fixture','Fixture',repeat('0',9),'00000000-0000-0000-0000-000000000001');
      SET ROLE authenticated;`);
    try {await db.query('SELECT count(*) FROM employee_private_profiles'); findings.push('UNEXPECTED: Owner read allowed');}
    catch(e){findings.push(`FAIL intended PR67 Owner RLS read with existing helper ACL: SQLSTATE ${e.code}`);}
    console.log(JSON.stringify({sourceCommit,commitStatements:(source.match(/COMMIT;/g)||[]).length,findings},null,2));
    process.exitCode=1;
  } finally {await db.close();}
})().catch(e=>{console.error(`Audit setup failed: ${e.code||'unclassified'}`);process.exitCode=1;});
