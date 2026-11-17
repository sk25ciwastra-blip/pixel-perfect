// Focused source regression only. No network, database or previously passing suites.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const ts=require(process.env.TS_MODULE || 'typescript');
const root=process.env.CLOSING_PACKAGE_ROOT || path.resolve(__dirname,'..');
const original=fs.readFileSync(path.join(root,'scripts/fixtures/lovable-3218bd2/src/routes/keuangan.tsx'),'utf8');
const patch=fs.readFileSync(path.join(root,'patches/operational-integration-lovable-3218bd2.patch'),'utf8');
const marker='--- a/src/routes/keuangan.tsx\n';
assert.ok(patch.includes(marker),'Finance must be included in the reviewed integration artifact');
const financePatch=patch.slice(patch.indexOf(marker)).split(/\n(?=--- a\/)/)[0];
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'b25-finance-source-'));
process.on('exit',()=>fs.rmSync(temp,{recursive:true,force:true}));
fs.mkdirSync(path.join(temp,'src/routes'),{recursive:true});
fs.writeFileSync(path.join(temp,'src/routes/keuangan.tsx'),original);
const applied=spawnSync('git',['apply','--whitespace=error','-'],{cwd:temp,input:financePatch,encoding:'utf8'});
assert.equal(applied.status,0,applied.stderr);
const candidate=fs.readFileSync(path.join(temp,'src/routes/keuangan.tsx'),'utf8');
const own={id:'owner-session',opened_by:'owner-user',status:'OPEN'};
const assisted={id:'reception-session',opened_by:'reception-user',status:'OPEN'};
function js(s){return ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText}
function preamble(source,context){
 const start=source.indexOf('function HalamanKeuangan() {');
 const end=source.indexOf('  async function refreshFinance()',start);
 const effects=[];let state=0;
 const sandbox={usePeran:()=>({posisiKode:'owner',training:{is_training:false}}),useState:v=>[source===original&&state++===0?'owner-user':v,()=>{}],useMemo:f=>f(),useEffect:f=>effects.push(f),useTable:()=>({rows:[own,assisted],loading:false}),useSesiKasKonteks:()=>context};
 return vm.runInNewContext(js(source.slice(start,end)+'return {selectedSession,activeSession};}\nHalamanKeuangan();'),sandbox);
}
const chosen={activeSession:assisted,ownSession:own,needsAssistedContext:false,selectAssistedSession:()=>true};
assert.equal(preamble(original,chosen).selectedSession.id,own.id);
assert.equal(preamble(candidate,chosen).selectedSession.id,assisted.id);
console.log('PASS new regression: actual Finance preamble preserves helper selection despite own OPEN session; baseline selected own session');
assert.equal(preamble(candidate,{...chosen,activeSession:undefined,needsAssistedContext:true}).selectedSession,undefined);
console.log('PASS new regression: closed explicit context does not select another drawer in Finance');
function nested(source,name){const sf=ts.createSourceFile('keuangan.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const page=sf.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='HalamanKeuangan');return page.body.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text===name).getText(sf)}
function expected(summarySessionId){const start=candidate.indexOf('  const expectedCash =');const end=candidate.indexOf('  const hasExpectedCash',start);return vm.runInNewContext(js(candidate.slice(start,end)+'expectedCash;'),{summarySessionId,selectedSession:assisted,summary:{expected_cash:0},angkaRingkasan:v=>v==null?null:Number(v)});}
assert.equal(expected(own.id),null);assert.equal(expected(assisted.id),0);
console.log('PASS new regression: summary bound to another session cannot enable Closing');
(async()=>{let calls=[];const close=nested(candidate,'closeSession');async function invoke(ready){await vm.runInNewContext(js(close+'\ncloseSession();'),{selectedSession:assisted,hasExpectedCash:ready,cashDeficit:false,angka:Number,setorCash:'0',setorTransfer:'0',diLaci:'0',dibawa:'0',recipientUserId:'',closingReason:'DEMO closing approved separately',setMessage:()=>{},run:async f=>f(),rpc:async(name,payload)=>{calls.push({name,payload});return {error:null}}});}
await invoke(false);assert.equal(calls.length,0);console.log('PASS new regression: unavailable/mismatched summary sends no Closing RPC');
await invoke(true);assert.equal(calls.length,1);assert.equal(calls[0].payload._session_id,assisted.id);assert.deepEqual(JSON.parse(JSON.stringify(calls[0].payload._allocation)),{setor_cash:0,setor_transfer:0,di_laci:0,dibawa:0,recipient_user_id:null});console.log('PASS new regression: actual Closing handler submits chosen session with zero allocation');
})().catch(e=>{console.error(e);process.exitCode=1});
