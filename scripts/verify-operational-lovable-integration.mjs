// Apply the whole candidate to exact pinned source, then execute new relevant checks.
import {mkdtempSync,cpSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';import ts from 'typescript';
const root=resolve(new URL('..',import.meta.url).pathname),temp=mkdtempSync(join(tmpdir(),'b25-operational-review-'));
function run(command,args,options={}){const r=spawnSync(command,args,{cwd:temp,encoding:'utf8',...options});if(r.status!==0)throw Error(r.stdout+r.stderr);return r.stdout;}
try{
 cpSync(join(root,'scripts/fixtures/lovable-3218bd2/src'),join(temp,'src'),{recursive:true});
 const patch=join(root,'patches/operational-integration-lovable-3218bd2.patch');run('git',['apply','--check',patch]);run('git',['apply',patch]);
 for(const path of ['components/checklist-housekeeping.tsx','components/kerangka.tsx','lib/data-live.ts','lib/sesi-kas.ts','routes/housekeeping.tsx','routes/index.tsx','routes/kamar.tsx','lib/checklist-for-ready-job.ts']){
 const r=ts.transpileModule(readFileSync(join(temp,'src',path),'utf8'),{fileName:path,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});assert.equal(r.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,path);
 }
 const dashboard=readFileSync(join(temp,'src/routes/index.tsx'),'utf8');const room=readFileSync(join(temp,'src/routes/kamar.tsx'),'utf8');const profile=readFileSync(join(temp,'src/components/kerangka.tsx'),'utf8');
 assert.match(dashboard,/tanggalWib\(mulai\) === hariKedatanganWib/);assert.match(dashboard,/const overtimePerluTindakan = useMemo/);assert.match(dashboard,/terisi: kamarTerisi.length/);assert.match(dashboard,/checkoutDisabledReason\(item, room\)/);assert.match(dashboard,/checkOut\(item.id\)/);assert.match(dashboard,/PopupBerhasil/);assert.match(dashboard,/font-mono text-gold/);
 assert.match(room,/kamar-kartu/);assert.match(room,/ring-2 ring-destructive/);assert.match(room,/PERLU TINDAKAN/);assert.match(room,/checklistForReadyJob/);assert.match(room,/PopupKamarTerisi/);assert.doesNotMatch(room,/checklist.issue_note.trim\(\)/);
 assert.match(profile,/Bantu Sesi Aktif/);assert.match(profile,/Sesi pilihan sudah ditutup/);
 console.log(run(process.execPath,['--test',join(root,'scripts/housekeeping-operational-recovery.test.mjs')],{env:{...process.env,HK_SOURCE_ROOT:temp}}));
 console.log('PASS complete eight-file patch, TSX syntax, combined source invariants, 13 actual-handler tests. Not a browser/Cloud PASS.');
}finally{rmSync(temp,{recursive:true,force:true});}
