// New regression only: actual Dashboard payment mapping; no app/network/Cloud writes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const ts=require(process.env.TS_MODULE||'typescript');
const root=process.env.PAYMENT_ORIGIN_PACKAGE_ROOT||path.resolve(__dirname,'..');
const original=fs.readFileSync(path.join(root,'scripts/fixtures/lovable-3218bd2/src/routes/index.tsx'),'utf8');
const patch=fs.readFileSync(path.join(root,'patches/operational-integration-lovable-3218bd2.patch'),'utf8');
const mark='--- a/src/routes/index.tsx\n';assert.ok(patch.includes(mark));
const hunk=patch.slice(patch.indexOf(mark)).split(/\n(?=--- )/)[0].replace(/\n?$/,'\n');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'b25-origin-'));
process.on('exit',()=>fs.rmSync(temp,{recursive:true,force:true}));
fs.mkdirSync(path.join(temp,'src/routes'),{recursive:true});fs.writeFileSync(path.join(temp,'src/routes/index.tsx'),original);
const apply=spawnSync('git',['apply','--whitespace=error','-'],{cwd:temp,input:hunk,encoding:'utf8'});assert.equal(apply.status,0,apply.stderr);
const candidate=fs.readFileSync(path.join(temp,'src/routes/index.tsx'),'utf8');
function mapping(source,trx){const start=source.indexOf('const masuk = payments.rows.map');const end=source.indexOf('    const keluar =',start);assert.ok(start>=0&&end>start);const code=ts.transpileModule(source.slice(start,end)+'\nmasuk;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return vm.runInNewContext(code,{payments:{rows:[{id:'payment',transaction_id:'trx',amount:70000,method:'Cash',created_at:'2026-11-17T11:04:03Z'}]},transaksi:trx?[{id:'trx',guest_id:'guest',transaction_number:'BTRDTRX-000029',...trx}]:[],guests:{rows:[{id:'guest',full_name:'SYNTHETIC',phone:'080000001713'}]},namaDepan:n=>n})[0];}
const walkin={started_at:'2026-11-17T11:04:03Z',scheduled_check_in:null,status:'check_out'};
assert.equal(mapping(original,walkin).sub,'Booking');
assert.equal(mapping(candidate,walkin).sub,'Walk-in');console.log('PASS Walk-in Cash maps to Walk-in; original baseline reproduced wrong Booking label');
assert.equal(mapping(candidate,{...walkin,scheduled_check_in:'2026-11-17T08:35:00Z'}).sub,'Booking');console.log('PASS Booking remains Booking after check-in/checkout');
assert.equal(mapping(candidate,null).sub,'Pembayaran');console.log('PASS unreadable/missing transaction does not invent Booking or Walk-in');
assert.equal(mapping(candidate,walkin).nominal,70000);
assert.equal(mapping(candidate,walkin).trxId,'trx');
const syntax=ts.transpileModule(candidate,{fileName:'index.tsx',reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}});
assert.equal(syntax.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
console.log('PASS complete actual Dashboard candidate TSX syntax; payment amount/identity retained');
