import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { meta } from '@/lib/meta';
import { startEmployeeEmailSetup } from '@/lib/employee-email-setup-flow';
import { exchangeEmployeeEmailSetup, readEmployeeSetupPublicPolicy, resumeOwnEmployeeSetup } from '@/lib/employee-email.functions';
import { changeOwnPassword } from '@/lib/employee-secure.functions';
import { validateOwnPasswordChange } from '@/lib/employee-enrollment';
export const Route = createFileRoute('/reset-password')({ head: () => meta('Atur Ulang Kata Sandi', 'Perbarui kata sandi akun Baturaden 25 Homestay.'), component: Reset });
function Reset() {
  const navigate = useNavigate(); const [password, setPassword] = useState(''); const [message, setMessage] = useState('');
  const setupStarted=useRef(false);const setupAccess=useRef<string|null>(null);const setupLink=useRef<string|null>(null);const setupInFlight=useRef(false);const [employeeFlow,setEmployeeFlow]=useState(false);
  useEffect(()=>{
    if(setupStarted.current)return;
    setupStarted.current=true;
    if(!new URLSearchParams(window.location.hash.slice(1)).has('token_hash')){
      void supabase.auth.getSession().then(async({data})=>{
        if(!data.session)return;
        try{await resumeOwnEmployeeSetup({headers:{Authorization:`Bearer ${data.session.access_token}`}});setupAccess.current=data.session.access_token;setEmployeeFlow(true);}catch{/* preserve normal non-enrollment recovery */}
      }).catch(()=>{});return;
    }
    setEmployeeFlow(true);
    setupLink.current=window.location.href;
    const u=new URL(window.location.href);window.history.replaceState(null,'',u.origin+u.pathname);
    // Do NOT consume OTP on mount: mail security scanners may prefetch links.
  },[]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if(employeeFlow){
      if(setupInFlight.current)return;setupInFlight.current=true;
      try{
        const input=validateOwnPasswordChange({password});
        if(!setupAccess.current){
          const href=setupLink.current;if(!href)throw new Error('SETUP_UNAVAILABLE');setupLink.current=null;
          setupAccess.current=await startEmployeeEmailSetup(href,url=>window.history.replaceState(null,'',url),{
            policy:()=>readEmployeeSetupPublicPolicy(),clientAuthOrigin:import.meta.env['VITE_SUPABASE_URL']??'',
            hasSession:async()=>!!(await supabase.auth.getSession()).data.session,
            exchange:token=>exchangeEmployeeEmailSetup({data:token}),
            setSession:async session=>{const {error}=await supabase.auth.setSession(session);if(error)throw new Error('SETUP_SESSION_REJECTED');},
          });
        }
        await changeOwnPassword({data:input,headers:{Authorization:`Bearer ${setupAccess.current}`}});setupAccess.current=null;await supabase.auth.signOut({scope:'local'});await navigate({to:'/auth'});
      }catch(error){setMessage(error instanceof Error&&error.message==='SIGN_OUT_BEFORE_SETUP'?'Keluar dari akun saat ini, lalu buka kembali tautan email.':'Tidak dapat menyelesaikan setup. Hubungi Owner.');}
      finally{setupInFlight.current=false;}
      return;
    }
    if (!window.location.hash.includes('type=recovery')) { setMessage('Tautan pengaturan ulang tidak berlaku.'); return; } const { error } = await supabase.auth.updateUser({ password }); if (error) setMessage('Tidak dapat mengganti kata sandi. Minta tautan baru.'); else await navigate({ to: '/auth' });
  }
  return <main className="flex min-h-screen items-center justify-center bg-background px-4"><form onSubmit={submit} className="w-full max-w-sm space-y-4"><h1 className="text-2xl font-bold">Atur ulang kata sandi</h1><label className="block text-sm">Kata sandi baru<input required minLength={employeeFlow?12:8} type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4" /></label>{message && <p role="status">{message}</p>}<Button className="w-full">Simpan kata sandi</Button></form></main>;
}
