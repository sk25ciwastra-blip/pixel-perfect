// Same prerequisite bootstrap as #73, without executing its already-PASS journey.
const fs=require('node:fs');
const ids={owner:'11111111-1111-4111-8111-111111111111',supervisor:'22222222-2222-4222-8222-222222222222',receptionist:'33333333-3333-4333-8333-333333333333',hk:'44444444-4444-4444-8444-444444444444',training:'55555555-5555-4555-8555-555555555555'};
async function fixture(q){
 await q(`CREATE ROLE service_role NOLOGIN;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth TO authenticated,anon,service_role;`);
 const apply=file=>q(fs.readFileSync(file,'utf8'));
 for(const n of fs.readdirSync('drizzle/migrations').filter(n=>/^000[0-5]_.*\.sql$/.test(n)).sort())await apply('drizzle/migrations/'+n);
 for(const [role,id] of Object.entries(ids)){await q('INSERT INTO auth.users VALUES($1)',[id]);await q('INSERT INTO user_roles(user_id,role) VALUES($1,$2)',[id,role==='owner'?'owner':'employee']);}
 await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[ids.owner]);
 for(const n of fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')&&n<='20261019000001_harden_checkout_payment_settlement.sql'&&n!=='20261006000010_correct_p4_prices.sql').sort()){
  await apply('supabase/migrations/'+n);if(n==='20261006000002_room_type_pricing_catalog.sql')await apply('scripts/fixtures/operational-catalog.sql');
 }
 for(const [role,position] of [['supervisor','supervisor'],['receptionist','receptionist'],['hk','housekeeping'],['training','supervisor']])await q('INSERT INTO employees(user_id,name,employee_id,position,active) VALUES($1,$2,$3,$4,true)',[ids[role],'Synthetic '+role,'SYNTH-'+role,position]);
 await apply('supabase/migrations/20261104000000_atomic_combined_payments.sql');
}
module.exports={ids,fixture};
