const assert=require('node:assert/strict');
const {audit,assets}=require('./audit-published-runtime.cjs');
(async()=>{
 assert.deepEqual(assets('<script src="https://other.invalid/assets/x.js"></script><script src="/rest/v1/secret.js"></script><script src="/assets/a.js?token=x"></script>','https://pixel-perfect-homestay-hub.lovable.app/'),[]);
 const original=global.fetch,calls=[];
 try{
  global.fetch=async(url,options)=>{calls.push(url);assert.equal(options.redirect,'manual');assert.equal(options.credentials,'omit');assert.deepEqual(Object.keys(options.headers),['Accept']);return url.endsWith('/')?new Response('<script src="/assets/app.js"></script>'):new Response('const secret="SYNTHETIC_KEY_MARKER";const target="https://bgtztcfbkcrvcipxbfti.supabase.co";const r="open_finance_cash_session";');};
  const result=await audit();assert.equal(calls.length,2);assert.equal(result.status,'STATIC_TARGET_OBSERVED');assert.equal(result.matchesInactiveStaging,true);assert.deepEqual(result.backendRefSuffixes,['…bfti']);assert.equal(JSON.stringify(result).includes('SYNTHETIC_KEY_MARKER'),false);assert.equal(JSON.stringify(result).includes('bgtztcfbkcrvcipxbfti'),false);
  calls.length=0;global.fetch=async url=>{calls.push(url);return new Response(null,{status:302,headers:{Location:'https://lovable.dev/auth-bridge?code=SYNTHETIC_PRIVATE_MARKER'}});};
  const blocked=await audit();assert.equal(calls.length,1);assert.equal(blocked.status,'NOT_REACHED');assert.equal(blocked.redirect.hasQuery,true);assert.equal(JSON.stringify(blocked).includes('SYNTHETIC_PRIVATE_MARKER'),false);
 }finally{global.fetch=original;}
 console.log('PASS static audit: same-origin assets only, no Auth/RPC/cookies, keys/query stripped, auth bridge not followed (fake HTTP only)');
})().catch(()=>{console.error('FAIL static audit contract');process.exitCode=1;});
