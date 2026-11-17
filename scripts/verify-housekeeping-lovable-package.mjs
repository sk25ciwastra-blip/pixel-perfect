import { mkdtempSync, cpSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import ts from 'typescript';
const root=resolve(new URL('..',import.meta.url).pathname);
const temp=mkdtempSync(join(tmpdir(),'b25-hk-review-'));
function run(cmd,args,options={}){
 const r=spawnSync(cmd,args,{cwd:temp,encoding:'utf8',...options});
 if(r.status!==0)throw Error(r.stdout+r.stderr);return r.stdout;
}
try {
 cpSync(join(root,'scripts/fixtures/lovable-3218bd2/src'),join(temp,'src'),{recursive:true});
 const patch=join(root,'patches/housekeeping-operational-lovable-3218bd2.patch');
 run('git',['apply','--check',patch]);run('git',['apply',patch]);
 for(const path of ['src/routes/housekeeping.tsx','src/routes/kamar.tsx','src/components/checklist-housekeeping.tsx','src/lib/data-live.ts','src/lib/checklist-for-ready-job.ts']){
  const source=readFileSync(join(temp,path),'utf8');
  const result=ts.transpileModule(source,{fileName:path,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}});
  assert.equal(result.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,path);
 }
 const hk=readFileSync(join(temp,'src/routes/housekeeping.tsx'),'utf8');
 assert.equal((hk.match(/aria-label="Bagian Housekeeping"/g)||[]).length,1);
 assert.match(hk,/bagianHk\.map/);
 assert.equal((hk.match(/refresh\(\{ throwOnError: true \}\)/g)||[]).length,3);
 const room=readFileSync(join(temp,'src/routes/kamar.tsx'),'utf8');
 assert.match(room,/checklistForReadyJob\(housekeepingJob, historyRows, checklistRows\)/);
 assert.doesNotMatch(room,/checklist.issue_note.trim\(\)/);
 console.log(run(process.execPath,[join(root,'scripts/housekeeping-operational-recovery.test.mjs')],{cwd:root,env:{...process.env,HK_SOURCE_ROOT:temp}}));
 console.log('PASS: exact-source patch application, five TS/TSX syntax checks, integrated callbacks and 13 focused tests. Full Lovable application build/browser/Cloud mutations NOT REACHED.');
} finally {rmSync(temp,{recursive:true,force:true});}
