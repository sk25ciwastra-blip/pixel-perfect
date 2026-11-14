// Only the three #73 failures and their changed boundaries. No old broad suites.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const source=require('./finance-reconciliation-source.cjs');
const {run}=require('./operational-native-runner.cjs'),{ids,fixture}=require('./finance-reconciliation-fixture.cjs');
const pending='supabase/pending/20261114013018_finance_source_reconciliation_review.sql';
let phase='startup';
run(async lab=>{
 const db=await lab.database(),q=(s,p=[])=>db.sql.unsafe(s,p),one=async(s,p=[])=> (await q(s,p))[0]?.r;
 const report={main:source.MAIN,reusedCandidate:source.CANDIDATE,environment:'NATIVE_DISPOSABLE_ONLY',cases:[],cloudAction:'NO_ACTION_ALREADY_CORRECT_CANDIDATE',limitations:['Cloud types/defaults/constraints/full body not independently read','No live role/browser/cash or real Auth test','No receipt/thermal/flags/employee changes']};
 assert.equal(fs.readFileSync(pending,'utf8').replaceAll('\r\n','\n'),source.build());
 const assistBlock=/  IF NOT FOUND OR selected_session\.status[\s\S]*?(?=  NEW\.cash_session_id := selected_session\.id;)/;
 assert.equal(source.payment.replace(assistBlock,'<assist>'),source.oldPayment.replace(assistBlock,'<assist>'));
 assert.equal(source.closing.replace(source.newBranch,source.oldBranch).replace(source.authGuard,''),source.oldClosing);
 assert.equal(source.blob(source.MAIN,'supabase/migrations/20261104000000_atomic_combined_payments.sql'),source.blob(source.CANDIDATE,'supabase/migrations/20261104000000_atomic_combined_payments.sql'));
 const actor=role=>q("SELECT set_config('request.jwt.claim.sub',$1,false)",[ids[role]??'']);
 const check=(name)=>{report.cases.push({name,status:'PASS'});console.log('PASS '+name);};
 phase='bootstrap';await fixture(q);await q('SET ROLE authenticated');await actor('receptionist');
 const receptionSession=await one('SELECT open_finance_cash_session(100) r');await actor('supervisor');const supervisorSession=await one('SELECT open_finance_cash_session(0) r');
 await actor('owner');await one("SELECT set_finance_commission_config('PERCENTAGE',8,0) r");
 const pkg=await one("SELECT id r FROM packages WHERE name='Paket 24 Jam'");
 const rooms=Object.fromEntries((await q('SELECT room_number,id FROM rooms')).map(r=>[r.room_number,r.id]));
 const price=Number(await one("SELECT CASE get_operational_day_mode((now() AT TIME ZONE 'Asia/Jakarta')::date) WHEN 'weekday' THEN pr.weekday_price ELSE pr.weekend_price END r FROM package_room_type_prices pr JOIN rooms r ON r.room_number='06' JOIN room_types rt ON rt.id=r.room_type_id WHERE pr.package_id=$1 AND pr.pricing_group=rt.pricing_group",[pkg]));
 let serial=0;
 const reservation=(room,session,training=false)=>one(`SELECT ${training?'create_training_reservation':'create_reservation'}('check_in',$1,$2,'Synthetic','0000000'||$3::text,'Synthetic address',$4,'Cash','weekday',null,$5,$6) r`,[rooms[room],pkg,String(++serial).padStart(4,'0'),price,crypto.randomUUID(),session]);
 phase='source-baseline';await assert.rejects(reservation('06',receptionSession),/Sesi kas aktif penerima/);
 // Reproduce missing source ACL/NULL-actor boundary inside rollback-only probe.
 await q('BEGIN;SET ROLE anon');await actor(null);
 const unprotected=await one('SELECT close_finance_cash_session($1,$2,\'Synthetic rollback-only boundary\') r',[supervisorSession,{setor_cash:0,di_laci:0,dibawa:0,setor_transfer:0}]);
 assert.equal(Number(unprotected.expected_cash),0);await q('ROLLBACK;SET ROLE authenticated');await actor('owner');
 // The pending file is a trusted SQL-owner replay, not a business-Owner RPC.
 await assert.rejects(q(source.build()),/Trusted SQL object owner/);await q('ROLLBACK;RESET ROLE');
 phase='install-candidate';await q(source.build());
 const hashes=await q("SELECT proname,md5(replace(prosrc,chr(13),'')) body_md5,md5(replace(pg_get_functiondef(oid),chr(13),'')) definition_md5 FROM pg_proc WHERE oid IN ('public.finance_prepare_payment()'::regprocedure,'public.close_finance_cash_session(uuid,jsonb,text)'::regprocedure,'public.create_reservation_combined(text,uuid,uuid,text,text,text,jsonb,text,timestamptz,uuid,text,uuid,integer)'::regprocedure)");
 report.localFingerprints=hashes;
 report.ownerCloudFingerprints={finance_prepare_payment:'8fbcc9895e1466c2fd5dd30c0a4ab3a0',close_finance_cash_session:'3a297fed148508cfcc0c0cb64c7e3dd4',create_reservation_combined:'18b71c50c227c6780b34c3fad07dc2ed'};
 // Already corrected or partially drifted DB must be refused before any DDL.
 await assert.rejects(q(source.build()),/Not the locked main replay state/);await q('ROLLBACK');
 assert.equal(await one("SELECT has_function_privilege('authenticated','public.finance_training_context_matches_session(uuid,uuid)','EXECUTE') r"),false);
 assert.equal(await one("SELECT has_function_privilege('anon','public.close_finance_cash_session(uuid,jsonb,text)','EXECUTE') r"),false);
 assert.equal(await one("SELECT has_table_privilege('authenticated','public.payments','INSERT') r"),false);
 phase='assisted-session';await q('SET ROLE authenticated');
 for(const [role,room] of [['owner','06'],['supervisor','07']]){
  await actor(role);const number=await reservation(room,receptionSession);
  const p=(await q('SELECT p.recorded_by,p.cash_session_id,s.opened_by FROM payments p JOIN transactions t ON t.id=p.transaction_id JOIN finance_cash_sessions s ON s.id=p.cash_session_id WHERE t.transaction_number=$1',[number]))[0];
  assert.equal(p.recorded_by,ids[role]);assert.equal(p.opened_by,ids.receptionist);assert.equal(p.cash_session_id,receptionSession);
 }
 const counts=()=>one("SELECT jsonb_build_array((SELECT count(*) FROM guests),(SELECT count(*) FROM transactions),(SELECT count(*) FROM payments),(SELECT count(*) FROM finance_payment_batch_idempotency)) r");
 for(const role of ['receptionist','hk']){await actor(role);const before=await counts();await assert.rejects(reservation('08',supervisorSession));assert.deepEqual(await counts(),before);}
 await actor('owner');await one("SELECT create_finance_training_assignment($1,$2,(now() AT TIME ZONE 'Asia/Jakarta')::date) r",[ids.training,ids.supervisor]);
 await actor('training');const beforeTraining=await counts();await assert.rejects(reservation('08',receptionSession));await assert.rejects(reservation('08',receptionSession,true));assert.deepEqual(await counts(),beforeTraining);
 const trainingNumber=await reservation('08',supervisorSession,true);
 await actor('owner');
 assert.equal(await one('SELECT p.recorded_by r FROM payments p JOIN transactions t ON t.id=p.transaction_id WHERE t.transaction_number=$1',[trainingNumber]),ids.training);
 await q('RESET ROLE');await actor('supervisor');await q('UPDATE employees SET active=false WHERE user_id=$1',[ids.supervisor]);await q('SET ROLE authenticated');await assert.rejects(reservation('09',receptionSession));await q('RESET ROLE');await q('UPDATE employees SET active=true WHERE user_id=$1',[ids.supervisor]);
 await q('SET ROLE anon');await actor(null);await assert.rejects(one('SELECT close_finance_cash_session($1,$2,\'Synthetic anon deny\') r',[supervisorSession,{setor_cash:0}]),e=>e.code==='42501');await q('RESET ROLE;SET ROLE authenticated');
 await assert.rejects(one('SELECT close_finance_cash_session($1,$2,\'Synthetic null actor\') r',[supervisorSession,{setor_cash:0}]),e=>e.code==='42501');
 check('1 assisted session: actual Owner/Supervisor operator, Receptionist drawer; staff/inactive/Training shortcuts DENY; assigned wrapper only; no helper grant');
 phase='combined-schema';await q('RESET ROLE');
 const columns=await q("SELECT column_name,data_type,is_nullable,numeric_precision,numeric_scale,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name IN ('guest_count','extra_guest_count','extra_guest_unit_price','extra_guest_charge') ORDER BY column_name");
 assert.equal(columns.length,4);report.localColumnContract=columns;
 for(const c of columns){assert.equal(c.is_nullable,'NO');assert.equal(Number(c.column_default.match(/\d+/)[0]),({guest_count:2,extra_guest_count:0,extra_guest_unit_price:50000,extra_guest_charge:0})[c.column_name]);if(c.column_name.endsWith('count'))assert.equal(c.data_type,'integer');else {assert.equal(c.data_type,'numeric');assert.equal(c.numeric_precision,12);assert.equal(c.numeric_scale,2);}}
 assert.equal(await one("SELECT count(*)::int r FROM pg_constraint WHERE conrelid='transactions'::regclass AND conname IN ('transactions_guest_count_valid','transactions_extra_guest_count_valid','transactions_extra_guest_charge_valid')"),3);
 await q('SET ROLE authenticated');await actor('owner');
 const total=price+50000,dp=Math.ceil(total*0.4),request=crypto.randomUUID(),parts=[{method:'Cash',amount:Math.floor(dp/2),idempotency_key:crypto.randomUUID()},{method:'QRIS',amount:dp-Math.floor(dp/2),idempotency_key:crypto.randomUUID()}];
 const planned=await one('SELECT now()::text r');
 const combined=(room,key,payments,mode='booking')=>one('SELECT create_reservation_combined($1,$2,$3,$4,$5,$6,$7,\'weekday\',CASE WHEN $1=\'booking\' THEN $10::timestamptz ELSE null END,$8,\'synthetic\',$9,3) r',[mode,rooms[room],pkg,'Synthetic combined','00000009999','Synthetic address',payments,key,receptionSession,planned]);
 phase='combined-payment';const result=await combined('09',request,parts),tx=result.transaction_id;
 const snapshot=(await q('SELECT price_snapshot,guest_count,extra_guest_count,extra_guest_charge,minimum_dp_amount_snapshot FROM transactions WHERE id=$1',[tx]))[0];
 assert.equal(Number(snapshot.price_snapshot),total);assert.equal(snapshot.guest_count,3);assert.equal(snapshot.extra_guest_count,1);assert.equal(Number(snapshot.extra_guest_charge),50000);assert.equal(Number(snapshot.minimum_dp_amount_snapshot),dp);
 const beforeReplay=await counts();assert.deepEqual(await combined('09',request,parts),result);assert.deepEqual(await counts(),beforeReplay);
 await assert.rejects(combined('09',request,[{...parts[0],amount:parts[0].amount+1},parts[1]]));assert.deepEqual(await counts(),beforeReplay);
 const remaining=total-dp,settleKey=crypto.randomUUID(),settle=[{method:'Cash',amount:Math.floor(remaining/2),idempotency_key:crypto.randomUUID()},{method:'QRIS',amount:remaining-Math.floor(remaining/2),idempotency_key:crypto.randomUUID()}];
 const settleCall=()=>one('SELECT record_transaction_payment_combined($1,$2,$3,\'synthetic-settle\',$4) r',[tx,settle,settleKey,receptionSession]);
 const settled=await settleCall();assert.deepEqual(await settleCall(),settled);
 assert.equal(Number(await one('SELECT sum(amount) r FROM payments WHERE transaction_id=$1',[tx])),total);
 assert.equal(Number(await one('SELECT sum(commission_amount) r FROM payments WHERE transaction_id=$1',[tx])),Math.floor(total*0.08/1000)*1000);
 phase='combined-rollback';const beforeRollback=await counts();
 await assert.rejects(combined('12',crypto.randomUUID(),[{method:'Cash',amount:total/2,idempotency_key:crypto.randomUUID()},{method:'QRIS',amount:total-total/2,idempotency_key:parts[1].idempotency_key}],'check_in'),/Idempotency key pembayaran/);
 assert.deepEqual(await counts(),beforeRollback);assert.equal(await one('SELECT status::text r FROM rooms WHERE id=$1',[rooms['12']]),'ready');
 // Constraint checks are native, not fixture-only validation.
 await q('RESET ROLE');await assert.rejects(q('UPDATE transactions SET guest_count=0 WHERE id=$1',[tx]),e=>e.code==='23514');await assert.rejects(q('UPDATE transactions SET extra_guest_charge=0 WHERE id=$1',[tx]),e=>e.code==='23514');
 check('2 combined: reused exact schema/defaults/constraints, DP grand total, two methods, replay/tamper, commission once, second-component rollback');
 phase='negative-closing';await q('SET ROLE authenticated');await actor('owner');const negative=await one('SELECT open_finance_cash_session(0) r');
 await one("SELECT record_finance_expense($1,$2,5000,'CASH','Synthetic','Synthetic negative cash') r",[crypto.randomUUID(),negative]);
 const close=allocation=>one('SELECT close_finance_cash_session($1,$2,\'Synthetic reconciliation\') r',[negative,allocation]);
 await assert.rejects(close({setor_cash:1,di_laci:0,dibawa:0,setor_transfer:0}),/alokasi kas fisik nol/);await assert.rejects(close({setor_cash:0,di_laci:-5000,dibawa:0,setor_transfer:0}),/tidak boleh negatif/);assert.equal(await one('SELECT status r FROM finance_cash_sessions WHERE id=$1',[negative]),'OPEN');
 const negativeSnapshot=await close({setor_cash:0,di_laci:0,dibawa:0,setor_transfer:0});assert.equal(Number(negativeSnapshot.expected_cash),-5000);assert.equal(await one('SELECT status r FROM finance_cash_sessions WHERE id=$1',[negative]),'FINAL');
 const positive=receptionSession;
 const expected=Number(await one("SELECT s.opening_cash+coalesce(sum(p.amount) FILTER(WHERE p.method='Cash'),0) r FROM finance_cash_sessions s LEFT JOIN payments p ON p.cash_session_id=s.id WHERE s.id=$1 GROUP BY s.id",[positive]));assert.ok(expected>0);
 await assert.rejects(one('SELECT close_finance_cash_session($1,$2,\'Synthetic positive boundary\') r',[positive,{setor_cash:0,di_laci:0,dibawa:0,setor_transfer:0}]),/Alokasi kas tidak sama/);
 await one('SELECT close_finance_cash_session($1,$2,\'Synthetic positive close\') r',[positive,{setor_cash:expected,di_laci:0,dibawa:0,setor_transfer:0}]);
 check('3 negative closing: zero physical allocation, signed snapshot FINAL; positive/negative allocation boundaries preserved, no personal-advance table');
 report.result='THREE_LOCAL_SCENARIOS_PASS_NOT_CLOUD_RUNTIME';report.operationalStatus='NO_GO';fs.writeFileSync(path.join(lab.root,'finance-reconciliation-evidence.json'),JSON.stringify(report,null,2));
 console.log('NOT REACHED Cloud runtime/column defaults+constraints/browser/real cash/thermal; operational release remains NO-GO');
}).catch(e=>{console.error('FAIL finance reconciliation phase='+phase+' code='+(e.code||e.name));process.exitCode=1;});
