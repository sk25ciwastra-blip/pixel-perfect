import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { Button } from '@/components/ui/button';
import { meta } from '@/lib/meta';
import { seedDemoAccounts } from '@/lib/demo-accounts.functions';
export const Route = createFileRoute('/auth')({ head: () => meta('Masuk', 'Masuk ke Baturaden 25 Homestay.'), component: Auth });
function Auth() {
  const navigate = useNavigate();
  const seed = useServerFn(seedDemoAccounts);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [mode, setMode] = useState<'masuk'|'lupa'|'daftar'>('masuk'); const [busy, setBusy] = useState(false);
  useEffect(() => { void seed().catch(() => undefined); }, [seed]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    if (mode === 'lupa') { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); setError(error?.message ?? 'Jika alamat terdaftar, tautan pengaturan ulang sudah dikirim.'); }
    else if (mode === 'daftar') { const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } }); setError(error?.message ?? 'Periksa email untuk mengonfirmasi akun. Pemilik perlu memberi akses sebelum Anda dapat masuk.'); }
    else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError('Alamat email atau kata sandi tidak sesuai.'); setBusy(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
        const { data: employee } = await supabase.from('employees').select('active').eq('user_id', user.id).maybeSingle();
        if (role?.role === 'employee' && employee && !employee.active) {
          await supabase.auth.signOut();
          setError('Akun tidak aktif. Hubungi pemilik.');
          setBusy(false);
          return;
        }
      }
      await navigate({ to: '/' });
    }
    setBusy(false);
  }
  return <main className="flex min-h-screen items-center justify-center bg-background px-4"><div className="w-full max-w-sm space-y-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">25</span><div><h1 className="font-bold">Baturaden 25</h1><p className="text-sm text-muted-foreground">Homestay</p></div></div><h2 className="text-2xl font-bold">{mode === 'masuk' ? 'Masuk' : mode === 'lupa' ? 'Lupa kata sandi' : 'Daftar akun'}</h2><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">Alamat email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-input bg-background px-4" /></label>{mode !== 'lupa' && <label className="block text-sm font-medium">Kata sandi<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-input bg-background px-4" /></label>}{error && <p role="status" className="text-sm text-muted-foreground">{error}</p>}<Button disabled={busy} className="h-12 w-full rounded-xl">{mode === 'masuk' ? 'Masuk' : mode === 'lupa' ? 'Kirim tautan' : 'Daftar'}</Button></form>{mode === 'masuk' && <Button variant="outline" className="h-12 w-full" onClick={async () => { const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin }); if (result.error) setError('Tidak dapat masuk dengan Google.'); else if (!result.redirected) await navigate({ to: '/' }); }}>Masuk dengan Google</Button>}<div className="flex flex-wrap gap-4 text-sm text-primary"><Button variant="link" onClick={() => {setError('');setMode(mode === 'masuk' ? 'lupa' : 'masuk')}}>{mode === 'masuk' ? 'Lupa kata sandi?' : 'Kembali ke masuk'}</Button>{mode === 'masuk' && <Button variant="link" onClick={() => {setError('');setMode('daftar')}}>Daftar</Button>}</div></div></main>;
}
