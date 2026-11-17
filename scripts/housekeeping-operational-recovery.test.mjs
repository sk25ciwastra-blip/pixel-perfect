import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = path => readFileSync(process.env.HK_SOURCE_ROOT ? process.env.HK_SOURCE_ROOT+'/'+path : new URL('../'+path, import.meta.url),'utf8');
function compile(source) { return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText; }
const helperModule = {exports:{}};
vm.runInNewContext(compile(read('src/lib/checklist-for-ready-job.ts')), {exports:helperModule.exports});
const select = helperModule.exports.checklistForReadyJob;
const start = {id:'start-B',room_id:'room',transaction_id:'trx',job_id:'job-B',job_number:'HK-B',action:'start_cleaning',to_status:'cleaning'};
const ready = {...start,id:'finish-B',action:'finish_cleaning',to_status:'ready'};
const checklist = {id:'check-B',housekeeping_history_id:start.id,room_id:'room',transaction_id:'trx'};
test('links checklist through start history of the same official job',()=>assert.equal(select(ready,[start,ready],[checklist]),checklist));
test('newer checklist from another cycle cannot label latest READY job',()=>assert.equal(select(ready,[start,ready],[{...checklist,housekeeping_history_id:'start-C'}]),undefined));
test('same transaction or timestamp cannot substitute a job link',()=>assert.equal(select(ready,[{...start,job_id:'job-A'}],[checklist]),undefined));
test('legacy null job and override READY do not inherit an old checklist',()=>{
 assert.equal(select({...ready,job_id:null},[start],[checklist]),undefined);
 assert.equal(select({...ready,action:'override_ready'},[start],[checklist]),undefined);
});
test('room/transaction mismatch and duplicate matches fail closed',()=>{
 for(const row of [{...checklist,room_id:'other'},{...checklist,transaction_id:'other'}]) assert.equal(select(ready,[start],[row]),undefined);
 assert.equal(select(ready,[start],[checklist,{...checklist,id:'duplicate'}]),undefined);
});
const component = read('src/components/checklist-housekeeping.tsx');
const ast=ts.createSourceFile('checklist.tsx',component,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let save;
function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='save')save=n.getText(ast);ts.forEachChild(n,visit);}
visit(ast);assert.ok(save);
function harness({rpc=async()=>({error:null}),refresh=async()=>{},checks:overrides={}}={}) {
 const checks=Object.fromEntries(['towel','mineral_water','tissue','ashtray','tv_remote','fan','exhaust_fan'].map(k=>[k+'_ok',true]));
 Object.assign(checks,overrides);
 const state={calls:0,refreshes:0,closed:0,messages:[],saving:false};
 const context={checks,reasons:Object.fromEntries(Object.keys(checks).map(k=>[k,''])),items:Object.keys(checks).map(key=>({key})),
 inFlight:{current:false},committed:{current:null},checklistId:{current:'stable-id'},roomId:'room',
 setMessage:x=>state.messages.push(x),setSaving:x=>state.saving=x,setSaved:x=>state.saved=x,setUncertain:x=>state.uncertain=x,
 supabase:{rpc:async(name,args)=>{state.calls++;state.args=args;return rpc(name,args);}},
 onSaved:async result=>{state.refreshes++;return refresh(result);},onClose:()=>state.closed++};
 return {state,context,save:vm.runInNewContext(compile(save)+'\nsave',context)};
}
test('incomplete checklist never reaches RPC',async()=>{const h=harness({checks:{towel_ok:null}});await h.save();assert.equal(h.state.calls,0);});
test('X requires reason before RPC',async()=>{const h=harness({checks:{fan_ok:false}});await h.save();assert.equal(h.state.calls,0);});
test('successful commit followed by failed refresh retries only refresh',async()=>{
 let attempts=0; const h=harness({refresh:async()=>{if(!attempts++)throw Error('offline');}});
 await h.save();assert.equal(h.state.calls,1);assert.equal(h.state.closed,0);assert.equal(h.state.saved,true);assert.equal(h.state.saving,false);
 await h.save();assert.equal(h.state.calls,1);assert.equal(h.state.refreshes,2);assert.equal(h.state.closed,1);
});
test('transport failure keeps stable id and unlocks processing for retry',async()=>{
 let attempt=0;const ids=[];const h=harness({rpc:async(_,args)=>{ids.push(args._checklist_id);if(!attempt++)throw Error('network');return {error:null};}});
 await h.save();assert.equal(h.state.uncertain,true);assert.equal(h.state.saving,false);await h.save();assert.deepEqual(ids,['stable-id','stable-id']);assert.equal(h.state.closed,1);
});
test('returned RPC error preserves answers and does not refresh',async()=>{const h=harness({rpc:async()=>({error:{message:'denied'}})});await h.save();assert.equal(h.state.uncertain,true);assert.equal(h.state.saving,false);assert.equal(h.state.refreshes,0);assert.equal(h.state.closed,0);});
test('two clicks while RPC pending produce one request',async()=>{
 let done;const h=harness({rpc:()=>new Promise(resolve=>done=resolve)});const pending=h.save();await h.save();assert.equal(h.state.calls,1);done({error:null});await pending;assert.equal(h.state.closed,1);
});
test('needs_action is preserved without inventing READY severity policy',async()=>{const h=harness({checks:{fan_ok:false}});h.context.reasons.fan_ok='maintenance';await h.save();assert.equal(h.context.committed.current,'needs_action');assert.equal(h.state.closed,1);});
test('strict refresh surfaces PostgREST failures without changing background refresh behavior',async()=>{
 const src=read('src/lib/data-live.ts');
 const ast=ts.createSourceFile('live.ts',src,ts.ScriptTarget.Latest,true);
 let callback;
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='refresh')callback=n.initializer.arguments[0].getText(ast);ts.forEachChild(n,visit);}
 visit(ast);assert.ok(callback);
 const query={select:()=>query,order:()=>query,eq:()=>query,then:resolve=>resolve({data:null,error:{message:'refresh unavailable'}})};
 const context={supabase:{from:()=>query},enabled:true,table:'rooms',scopeColumn:undefined,scopeValue:undefined,setRows(){},setError(){},setLoading(){}};
 const refresh=vm.runInNewContext(compile('const refresh = '+callback)+'\nrefresh',context);
 await refresh();await assert.rejects(()=>refresh({throwOnError:true}),/refresh unavailable/);
});
