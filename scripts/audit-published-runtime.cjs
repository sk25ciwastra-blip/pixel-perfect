// Read-only anonymous static GETs. Never sends API keys, JWT, cookies or RPCs.
// Raw HTML/JS stays in memory; output contains only hashes and masked refs.
const crypto=require('node:crypto'),fs=require('node:fs');
const origin='https://pixel-perfect-homestay-hub.lovable.app';
const critical=['open_finance_cash_session','close_finance_cash_session','check_in_booking','check_out_transaction','get_finance_training_context','issue_payment_receipt','request_receipt_print','read_payment_confirmation_refunds'];
function assets(text,base){
 const found=new Set();
 for(const m of text.matchAll(/["']([^"'<>\s]+\.js(?:\?[^"'<>\s]*)?)["']/g)){
  try{const u=new URL(m[1],base);if(u.origin===origin&&/\/(assets|_build|build)\//.test(u.pathname)&&!u.search&&!u.hash)found.add(u.href);}catch{}
 }
 return [...found];
}
async function body(url){
 const r=await fetch(url,{redirect:'manual',credentials:'omit',headers:{Accept:'text/html,application/javascript'},signal:AbortSignal.timeout(15000)});
 if(!r.ok){let redirect=null;try{const u=new URL(r.headers.get('location'),url);redirect={origin:u.origin,path:u.pathname,hasQuery:!!u.search};}catch{}return {status:r.status,text:null,redirect};}
 const reader=r.body.getReader(),parts=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4*1024*1024){await reader.cancel();throw Error('STATIC_BODY_LIMIT');}parts.push(Buffer.from(value));}
 return {status:r.status,text:Buffer.concat(parts).toString('utf8')};
}
async function audit(){
 const result={checkedAt:new Date().toISOString(),origin,mode:'ANONYMOUS_STATIC_GET_ONLY',status:'NOT_REACHED',entryStatus:null,assets:[],backendRefSuffixes:[],references:Object.fromEntries(critical.map(n=>[n,false])),limitations:['Static asset configuration is not authenticated RPC success or proof of server-side target','No live login/session/transaction/flag inspection performed']};
 try{
  const entry=await body(origin+'/');result.entryStatus=entry.status;
  if(!entry.text)return {...result,redirect:entry.redirect??null,blocker:'ENTRY_HTTP_'+entry.status};
  const queue=assets(entry.text,origin+'/'),seen=new Set(),refs=new Set();
  while(queue.length&&seen.size<24){
   const url=queue.shift();if(seen.has(url))continue;seen.add(url);
   const asset=await body(url);result.assets.push({path:new URL(url).pathname,status:asset.status,sha256:asset.text?crypto.createHash('sha256').update(asset.text).digest('hex'):null});
   if(!asset.text)continue;
   for(const m of asset.text.matchAll(/https:\/\/([a-z0-9]{16,30})\.supabase\.co/g))refs.add(m[1]);
   for(const n of critical)if(asset.text.includes(n))result.references[n]=true;
   queue.push(...assets(asset.text,url));
  }
  result.backendRefSuffixes=[...refs].map(r=>'…'+r.slice(-4));
  result.matchesInactiveStaging=[...refs].some(r=>r==='bgtztcfbkcrvcipxbfti');
  result.status=refs.size?'STATIC_TARGET_OBSERVED':'NOT_REACHED';
  if(!refs.size)result.blocker='NO_BACKEND_TARGET_IN_SCANNED_ASSETS';
 }catch(e){result.blocker=e.message==='STATIC_BODY_LIMIT'?e.message:'STATIC_FETCH_UNAVAILABLE';}
 return result;
}
if(require.main===module)audit().then(r=>{if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(r,null,2));console.log(JSON.stringify(r,null,2));});
module.exports={audit,assets};
