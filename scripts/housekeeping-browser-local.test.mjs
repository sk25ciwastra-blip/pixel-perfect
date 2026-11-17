// Real Chromium DOM, actual ChecklistHousekeeping component; all RPC/data are fakes.
// Never connects to Lovable/Cloud. SOURCE_ROOT must contain the candidate source.
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const source=resolve(process.env.B25_SOURCE_ROOT||'.');
const {createServer}=await import(pathToFileURL(join(source,'node_modules/vite/dist/node/index.js')));
const {default:react}=await import(pathToFileURL(join(source,'node_modules/@vitejs/plugin-react/dist/index.js')));
const pw=process.env.B25_PLAYWRIGHT_MODULE||join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs');
const {chromium}=await import(pathToFileURL(pw));
const temp=mkdtempSync(join(source,'.hk-browser-'));
writeFileSync(join(temp,'index.html'),'<div id="root"></div><script type="module" src="/main.tsx"></script>');
writeFileSync(join(temp,'data.ts'),`export function useTable(){return {rows:[],loading:false,error:''};}`);
writeFileSync(join(temp,'button.tsx'),`export function Button({size,variant,...props}){return <button {...props}/>;}`);
writeFileSync(join(temp,'rpc.ts'),`export const supabase={rpc:async(name,args)=>{window.state.calls.push({name,args});if(window.state.delay)await new Promise(r=>setTimeout(r,window.state.delay));return {error:window.state.rpcError?{message:'network unavailable'}:null};}};`);
writeFileSync(join(temp,'main.tsx'),`import {useState} from 'react';import {createRoot} from 'react-dom/client';import {ChecklistHousekeeping} from '${source}/src/components/checklist-housekeeping.tsx';
window.state={calls:[],refreshes:0,refreshFailures:0,closed:0,delay:0,rpcError:false};
function App(){const [open,setOpen]=useState(true);return open?<ChecklistHousekeeping roomId="fixture-room" roomNumber="TEST" onClose={()=>{window.state.closed++;setOpen(false)}} onSaved={async()=>{window.state.refreshes++;if(window.state.refreshFailures){window.state.refreshFailures--;throw Error('refresh failed')}}}/>:<p>Closed</p>;}createRoot(document.getElementById('root')).render(<App/>);`);
let server,browser;
try{
 server=await createServer({configFile:false,root:temp,plugins:[react()],resolve:{alias:[{find:'@/lib/data-live',replacement:join(temp,'data.ts')},{find:'@/components/ui/button',replacement:join(temp,'button.tsx')},{find:'@/integrations/supabase/client',replacement:join(temp,'rpc.ts')}]},server:{host:'127.0.0.1',port:0,fs:{allow:[source]}},logLevel:'error'});await server.listen();
 const address=server.httpServer.address();const url=`http://127.0.0.1:${address.port}`;
 browser=await chromium.launch({executablePath:process.env.B25_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();
 const forbidden=[];await page.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){forbidden.push(route.request().url());return route.abort();}return route.continue();});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const open=async()=>{await page.goto(url);await page.getByRole('dialog').waitFor();};
 const passAll=async()=>{for(const b of await page.getByRole('button',{name:/ sesuai$/}).all())await b.click();};
 await open();await page.getByRole('button',{name:'Selesai Bersihkan'}).click();await page.getByRole('alert').filter({hasText:'wajib dijawab'}).waitFor();assert.equal(await page.evaluate(()=>window.state.calls.length),0);console.log('PASS DOM unanswered checklist sends no RPC');
 await passAll();await page.evaluate(()=>window.state.refreshFailures=1);await page.getByRole('button',{name:'Selesai Bersihkan'}).click();await page.getByRole('button',{name:'Muat ulang status'}).waitFor();assert.match(await page.getByRole('alert').innerText(),/sudah tersimpan/);assert.equal(await page.getByRole('button',{name:'Handuk: 2 buah sesuai'}).isDisabled(),true);await page.getByRole('button',{name:'Muat ulang status'}).click();await page.getByText('Closed',{exact:true}).waitFor();assert.deepEqual(await page.evaluate(()=>[window.state.calls.length,window.state.refreshes,window.state.closed]),[1,2,1]);console.log('PASS DOM post-commit refresh failure retries refresh only');
 await open();await passAll();await page.evaluate(()=>window.state.rpcError=true);await page.getByRole('button',{name:'Selesai Bersihkan'}).click();await page.getByRole('alert').filter({hasText:'network unavailable'}).waitFor();assert.equal(await page.getByRole('button',{name:'Handuk: 2 buah sesuai'}).isDisabled(),true);await page.evaluate(()=>window.state.rpcError=false);await page.getByRole('button',{name:'Selesai Bersihkan'}).click();await page.getByText('Closed',{exact:true}).waitFor();const ids=await page.evaluate(()=>window.state.calls.map(c=>c.args._checklist_id));assert.equal(ids.length,2);assert.equal(ids[0],ids[1]);console.log('PASS DOM returned RPC error freezes answers; retry preserves UUID');
 await open();await passAll();await page.evaluate(()=>window.state.delay=250);await page.getByRole('button',{name:'Selesai Bersihkan'}).click();assert.equal(await page.getByRole('button',{name:'Memproses…'}).isDisabled(),true);await page.getByText('Closed',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.state.calls.length),1);console.log('PASS DOM processing disables submit');
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);console.log('4 real browser cases PASS; no external requests and no Cloud writes.');
}finally{if(browser)await browser.close();if(server)await server.close();rmSync(temp,{recursive:true,force:true});}
