// Executes actual Finance action functions with separate view/context caches.
// No Cloud, auth tokens, UI transaction or prior Finance suite is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('src/routes/keuangan.tsx','utf8');
const hookSource = fs.readFileSync('src/lib/sesi-kas.ts','utf8');
const ast = ts.createSourceFile('keuangan.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const wanted = new Set(['refreshFinance','run','openSession']);
const declarations=[];
function visit(n){if(ts.isFunctionDeclaration(n)&&wanted.has(n.name?.text))declarations.push(n.getText(ast));ts.forEachChild(n,visit);}
visit(ast);assert.equal(declarations.length,3);
const actual = ts.transpileModule(declarations.join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function harness(code,{error=null,existing=null}={}) {
 const calls=[],state={view:null,context:null,busy:false,message:'',contextRefreshes:0,summary:null};
 const newSession={id:'synthetic-session',status:'OPEN',opened_by:'synthetic-operator'};
 const ctx={
  selectedSession:existing,isTraining:false,openingCash:'0',angka:Number,
  setBusy:v=>state.busy=v,setMessage:v=>state.message=v,
  setSummary:v=>state.summary=v,setSummarySessionId:v=>state.summaryId=v,
  refreshSessions:async()=>{state.contextRefreshes++;state.context=newSession;},
  sessions:{refresh:async()=>{state.view=newSession;}},
  rpc:async(name,args)=>{calls.push({name,args});return name==='open_finance_cash_session'?{error}:{data:{expected_cash:0}};},
 };
 for(const name of ['deposits','payments','refunds','banks','employees','handoffs','expenses'])ctx[name]={refresh:async()=>{}};
 const f=new Function(...Object.keys(ctx),code+'\nreturn {openSession,refreshFinance};')(...Object.values(ctx));
 return {f,state,calls};
}
(async()=>{
 // Negative control reproduces LIVE: only the route list refreshes without the fix.
 const before=harness(actual.replace('refreshSessions(), ',''));
 await before.f.openSession();
 assert.equal(before.state.view?.status,'OPEN');assert.equal(before.state.context,null);
 const after=harness(actual);await after.f.openSession();
 assert.equal(after.state.contextRefreshes,1);assert.equal(after.state.context?.status,'OPEN');
 assert.equal(after.state.view?.id,after.state.context.id);assert.equal(after.state.busy,false);
 assert.deepEqual(after.calls,[{name:'open_finance_cash_session',args:{_opening_cash:0}}]);
 const denied=harness(actual,{error:{message:'Denied'}});await denied.f.openSession();
 assert.equal(denied.state.contextRefreshes,0);assert.equal(denied.state.message,'Denied');assert.equal(denied.state.busy,false);
 assert.equal(denied.calls.length,1);
 const existing=harness(actual,{existing:{id:'selected-session'}});await existing.f.refreshFinance();
 assert.deepEqual(existing.calls,[{name:'get_finance_session_summary',args:{_session_id:'selected-session'}}]);
 assert.equal(existing.state.summaryId,'selected-session');
 assert.ok(hookSource.includes('refreshSessions: sessions.refresh,'));
 assert.ok(source.includes('selectAssistedSession, refreshSessions } = useSesiKasKonteks()'));
 console.log('PASS: reproduced independent-cache failure; successful open refreshes both caches; one Rp0 RPC; denial no refresh/retry; existing selected summary preserved; hook wired.');
})().catch(e=>{console.error(e);process.exitCode=1;});
