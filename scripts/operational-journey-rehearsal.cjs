// One new cross-module journey, not a rerun of existing unit/security suites.
// Full source SQL, native disposable DB, synthetic users only. No network Auth.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {run}=require('./operational-native-runner.cjs');
const read=p=>fs.readFileSync(p,'utf8');
const ids={owner:'11111111-1111-4111-8111-111111111111',supervisor:'22222222-2222-4222-8222-222222222222',receptionist:'33333333-3333-4333-8333-333333333333',hk:'44444444-4444-4444-8444-444444444444',training:'55555555-5555-4555-8555-555555555555'};
let phase='startup';
run(async lab=>{
 const db=await lab.database(),sql=db.sql,q=(s,p=[])=>sql.unsafe(s,p),one=async(s,p=[])=> (await q(s,p))[0]?.r;
 const report={checkedAt:new Date().toISOString(),baseline:'17161ef9aee2bcbf2ab702f3598a43d9b2efdcb1',environment:'DISPOSABLE_NATIVE_PG',ledger:[],checks:[],blockers:[]};
 const status=(name,state,detail)=>{report.checks.push({name,state,detail});console.log(state+' '+name+' '+detail);};
 const apply=async file=>{phase='migration:'+path.basename(file);const text=read(file);await q(text);report.ledger.push({file,sha256:crypto.createHash('sha256').update(text).digest('hex')});};
 const actor=async role=>q("SELECT set_config('request.jwt.claim.sub',$1,false)",[ids[role]??'']);
 phase='bootstrap';await q(`CREATE ROLE service_role NOLOGIN;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth TO authenticated,anon,service_role;`);
 for(const file of fs.readdirSync('drizzle/migrations').filter(n=>/^000[0-5]_.*\.sql$/.test(n)).sort())await apply('drizzle/migrations/'+file);
 for(const [role,id] of Object.entries(ids)){await q('INSERT INTO auth.users VALUES($1)',[id]);await q('INSERT INTO user_roles(user_id,role) VALUES($1,$2)',[id,role==='owner'?'owner':'employee']);}
 await actor('owner');
 const migrations=fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')&&n<='20261019000001_harden_checkout_payment_settlement.sql'&&n!=='20261006000010_correct_p4_prices.sql').sort();
 for(const file of migrations){await apply('supabase/migrations/'+file);if(file==='20261006000002_room_type_pricing_catalog.sql')await apply('scripts/fixtures/operational-catalog.sql');}
 for(const [role,position] of [['supervisor','supervisor'],['receptionist','receptionist'],['hk','housekeeping'],['training','receptionist']])await q('INSERT INTO employees(user_id,name,employee_id,position,active) VALUES($1,$2,$3,$4,true)',[ids[role],'Synthetic '+role,'SYNTH-'+role,position]);
 // Additional main/pending candidates applied only here, never to any remote DB.
 for(const file of ['supabase/migrations/20261022000002_booking_time_dashboard_enforcement.sql','supabase/migrations/20261104000000_atomic_combined_payments.sql','supabase/pending/20261112_booking_late_checkin_checkout_cap.sql','supabase/pending/20261113145045_booking_fixed_slot_boundary.sql','supabase/pending/20261113150233_overtime_walkin_guard.sql','supabase/pending/20261112175446_payment_confirmation_refunds.sql'])await apply(file);
 phase='role-session-journey';await q('SET ROLE authenticated');await actor('owner');
 // Revalidate only this new full-chain planning seam; old timing suites stay untouched.
 for(const [name,start,end] of [['Paket Pagi','2030-12-31T08:30:00+07:00','2030-12-31T16:00:00+07:00'],['Paket Malam','2030-12-31T22:00:00+07:00','2031-01-01T08:00:00+07:00'],['Paket Harian','2030-12-31T13:00:00+07:00','2031-01-01T12:00:00+07:00']]){
  const p=await one('SELECT id r FROM packages WHERE name=$1',[name]);const planned=(await q('SELECT * FROM calculate_scheduled_booking_times($1,$2)',[p,start]))[0];assert.equal(new Date(planned.scheduled_check_out).toISOString(),new Date(end).toISOString());
 }
 status('fixed-slot-full-chain-planning','PASS','Pagi/Malam/Harian official WIB endpoints incl year rollover; not live arrivals/browser');
 await one("SELECT create_finance_training_assignment($1,$2,(now() AT TIME ZONE 'Asia/Jakarta')::date) r",[ids.training,ids.supervisor]);
 await actor('training');await assert.rejects(one('SELECT open_finance_cash_session(0) r'));
 await actor('receptionist');const session=await one('SELECT open_finance_cash_session(10000) r');
 status('session-open','PASS','caller-scoped native receptionist session');
 await actor('owner');await one("SELECT set_finance_commission_config('PERCENTAGE',8,0) r");
 const room=(await q("SELECT r.id FROM rooms r WHERE room_number='06'"))[0].id;
 const pkg=(await q("SELECT id FROM packages WHERE name='Paket 24 Jam'"))[0].id;
 const total=Number(await one("SELECT CASE get_operational_day_mode((now() AT TIME ZONE 'Asia/Jakarta')::date) WHEN 'weekday' THEN pr.weekday_price ELSE pr.weekend_price END r FROM package_room_type_prices pr JOIN rooms r ON r.id=$1 JOIN room_types rt ON rt.id=r.room_type_id WHERE pr.package_id=$2 AND pr.pricing_group=rt.pricing_group",[room,pkg]));
 const settings=(await q('SELECT minimum_dp_mode,minimum_dp_value FROM finance_settings WHERE id=true'))[0];
 const dp=Math.ceil(settings.minimum_dp_mode==='PERCENTAGE'?total*Number(settings.minimum_dp_value)/100:Number(settings.minimum_dp_value));
 const create=(amount)=>one("SELECT create_reservation('booking',$1,$2,'Synthetic Guest','00000000000','Synthetic isolated address',$3,'Cash','weekday',now(),$4,$5) r",[room,pkg,amount,crypto.randomUUID(),session]);
 phase='cross-session-owner';
 await assert.rejects(create(dp),/Sesi kas aktif penerima pembayaran tidak ditemukan/);
 assert.equal(await one('SELECT count(*)::int r FROM transactions'),0);
 status('owner-help-receptionist-session','FAIL','main payment trigger rejects Owner operator using selected receptionist session; Cloud definition unknown');
 report.blockers.push('MAIN_OWNER_OPERATOR_FOREIGN_SESSION_GUARD_DRIFT');
 await actor('receptionist');phase='booking-dp';await assert.rejects(create(dp-1),/DP minimum/);const number=await create(dp);
 const trx=(await q('SELECT * FROM transactions WHERE transaction_number=$1',[number]))[0];
 await actor('receptionist');await assert.rejects(one('SELECT check_in_booking($1) r',[trx.id]),/Sisa pembayaran/);
 await one("SELECT record_transaction_payment($1,$2,'QRIS',$3,$4) r",[trx.id,total-dp,crypto.randomUUID(),session]);
 const paymentCount=await one('SELECT count(*)::int r FROM payments WHERE transaction_id=$1',[trx.id]);
 await one('SELECT check_in_booking($1) r',[trx.id]);
 assert.equal(await one('SELECT id::text r FROM transactions WHERE transaction_number=$1',[number]),trx.id);
 assert.equal(await one('SELECT count(*)::int r FROM payments WHERE transaction_id=$1',[trx.id]),paymentCount);
 status('booking-payment-checkin','PASS','minimum DP + settlement, canonical same TRX, no extra payment on check-in');
 await one('SELECT check_out_transaction($1) r',[trx.id]);assert.equal(await one('SELECT status::text r FROM rooms WHERE id=$1',[room]),'dirty');
 phase='housekeeping';await actor('hk');await one("SELECT advance_room_cleaning($1,'Synthetic clean') r",[room]);
 await one("SELECT complete_housekeeping_checklist($1,$2,false,true,true,true,true,true,true,$3) r",[room,crypto.randomUUID(),JSON.stringify({towel:'Synthetic stock shortage'})]);
 assert.equal(await one('SELECT status::text r FROM rooms WHERE id=$1',[room]),'ready');
 status('checkout-housekeeping','PASS','checkout -> dirty -> cleaning -> ready; shortage note does not block ready');
 phase='closing-refund';await actor('owner');await one('SELECT close_finance_cash_session($1,$2,$3) r',[session,{setor_cash:10000+dp,setor_transfer:0,di_laci:0,dibawa:0},'Synthetic Owner closing']);
 assert.equal(await one('SELECT status r FROM finance_cash_sessions WHERE id=$1',[session]),'FINAL');
 const finalSnapshot=JSON.stringify((await q('SELECT * FROM finance_cash_sessions WHERE id=$1',[session]))[0]);
 // Checkout-frozen settlement is an existing rule, not a gap to bypass.
 await assert.rejects(one("SELECT create_finance_refund($1,$2,20000,'CASH','OWNER_FUNDS',null,'Synthetic closed-transaction probe') r",[crypto.randomUUID(),trx.id]),/Settlement tidak dapat diubah/);
 assert.equal(JSON.stringify((await q('SELECT * FROM finance_cash_sessions WHERE id=$1',[session]))[0]),finalSnapshot);
 status('closing-booking-journey','PASS','settled booking -> checkout -> HK -> cash FINAL; closed transaction refund denied atomically');
 phase='walkin-post-closing-refund';
 const ownerSession=await one('SELECT open_finance_cash_session(0) r');
 const secondRoom=(await q("SELECT id FROM rooms WHERE room_number='07'"))[0].id;
 const walkNumber=await one("SELECT create_reservation('check_in',$1,$2,'Synthetic Walkin','00000000001','Synthetic isolated address',$3,'Cash','weekday',null,$4,$5) r",[secondRoom,pkg,total,crypto.randomUUID(),ownerSession]);
 const walk=(await q('SELECT * FROM transactions WHERE transaction_number=$1',[walkNumber]))[0];
 await one('SELECT close_finance_cash_session($1,$2,$3) r',[ownerSession,{setor_cash:total,setor_transfer:0,di_laci:0,dibawa:0},'Synthetic walkin session close']);
 const walkFinal=JSON.stringify((await q('SELECT * FROM finance_cash_sessions WHERE id=$1',[ownerSession]))[0]);
 const commissionBefore=Number(await one('SELECT sum(commission_amount) r FROM payments WHERE transaction_id=$1',[walk.id]));
 await one("SELECT create_finance_refund($1,$2,20000,'CASH','OWNER_FUNDS',null,'Synthetic Owner Funds after session closing') r",[crypto.randomUUID(),walk.id]);
 assert.equal(JSON.stringify((await q('SELECT * FROM finance_cash_sessions WHERE id=$1',[ownerSession]))[0]),walkFinal);
 const adjustment=Number(await one('SELECT sum(commission_adjustment) r FROM finance_refunds WHERE transaction_id=$1',[walk.id]));
 assert.ok(adjustment<=0&&commissionBefore+adjustment>=0);
 await assert.rejects(one('SELECT check_out_transaction($1) r',[walk.id]),/sisa settlement/);
 const pdf=await one('SELECT read_payment_confirmation_refunds($1) r',[walk.id]);assert.equal(pdf.complete,true);assert.equal(pdf.refund_count,1);assert.equal(pdf.payment_count,1);
 const net=Number(await one('SELECT (SELECT sum(amount) FROM payments WHERE transaction_id=$1)-(SELECT sum(amount) FROM finance_refunds WHERE transaction_id=$1) r',[walk.id]));assert.ok(net<total);
 status('walkin-refund-commission-pdf-ledger','PASS','Owner Funds refund while TRX active preserves FINAL session, adjusts commission; net unpaid checkout denied; scoped PDF ledger complete (not browser/PDF render)');
 phase='source-release-blockers';await q('RESET ROLE');
 const receipt=await one("SELECT to_regprocedure('public.issue_payment_receipt(uuid)') IS NOT NULL r");
 status('thermal-model-A-db',receipt?'PASS':'NOT_REACHED',receipt?'RPC present':'No receipt SQL foundation in this main ledger; renderer PASS evidence retained, no fake snapshot');
 if(!receipt)report.blockers.push('RECEIPT_SQL_LEDGER_INCOMPLETE_NOT_CLOUD_PROOF');
 const extra=Number(await one("SELECT count(*)::int r FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name IN ('guest_count','extra_guest_count','extra_guest_unit_price','extra_guest_charge')"));
 status('combined-prerequisites',extra===4?'PASS':'FAIL',extra===4?'source columns present':'main combined RPC references missing extra-guest foundation columns');
 if(extra!==4)report.blockers.push('MAIN_COMBINED_EXTRA_GUEST_PREREQUISITE_DRIFT');
 phase='negative-closing-probe';await actor('owner');await q('SET ROLE authenticated');
 const negativeSession=await one('SELECT open_finance_cash_session(0) r');
 await one("SELECT record_finance_expense($1,$2,5000,'CASH','Synthetic','Synthetic isolated deficit') r",[crypto.randomUUID(),negativeSession]);
 await assert.rejects(one('SELECT close_finance_cash_session($1,$2,$3) r',[negativeSession,{setor_cash:0,setor_transfer:0,di_laci:0,dibawa:0},'Synthetic negative close']),/Alokasi kas tidak sama/);
 await assert.rejects(one('SELECT close_finance_cash_session($1,$2,$3) r',[negativeSession,{setor_cash:0,setor_transfer:0,di_laci:0,dibawa:-5000},'Synthetic negative close']),/tidak boleh negatif/);
 assert.equal(await one('SELECT status r FROM finance_cash_sessions WHERE id=$1',[negativeSession]),'OPEN');
 status('negative-closing-contract','FAIL','native expected cash -5000 cannot close with zero or signed allocation; rejection is atomic');
 report.blockers.push('NEGATIVE_CLOSING_LIVE_DEFINITION_NOT_VERIFIED');
 phase='readonly-recipe';await q('RESET ROLE');await q(read('supabase/reconciliation/operational_readonly_preflight_20261114.sql'));
 status('readonly-metadata-recipe','PASS','metadata-only recipe executed in disposable DB, never Cloud');
 report.result='REHEARSAL_EXECUTED_NOT_RELEASE_GO';report.liveStatus='NO_GO';
 fs.writeFileSync(path.join(lab.root,'operational-evidence.json'),JSON.stringify(report,null,2));
 console.log('NOT REACHED published target/authenticated Cloud journey/physical printer; NO-GO operational pilot');
}).catch(e=>{console.error('FAIL operational rehearsal phase='+phase+' code='+(e.code||e.name));process.exitCode=1;});
