// Browser-safe protocol helpers only; no secret/config approval keys here.
export function employeeSetupToken(input:unknown){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('CALLBACK_INPUT_INVALID');
  const r=input as Record<string,unknown>;
  if(Object.keys(r).sort().join(',')!=='tokenHash,type'||r['type']!=='recovery'||typeof r['tokenHash']!=='string'||!/^[a-zA-Z0-9_-]{32,256}$/.test(r['tokenHash']))throw new Error('CALLBACK_INPUT_INVALID');
  return {tokenHash:r['tokenHash'],type:'recovery' as const};
}
export function captureEmployeeSetupFragment(href:string,approvedCallback:string,replace:(cleanUrl:string)=>void){
  const u=new URL(href),expected=new URL(approvedCallback);
  if(u.origin!==expected.origin||u.pathname!==expected.pathname||u.search||expected.search||expected.hash)throw new Error('CALLBACK_INPUT_INVALID');
  try{
    const p=new URLSearchParams(u.hash.slice(1));
    if([...p.keys()].sort().join(',')!=='token_hash,type')throw new Error('CALLBACK_INPUT_INVALID');
    return employeeSetupToken({tokenHash:p.get('token_hash'),type:p.get('type')});
  }finally{replace(expected.href);} // remove fragment before analytics/render/storage
}
