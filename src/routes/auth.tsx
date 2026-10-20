import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { Button } from '@/components/ui/button';
import { meta } from '@/lib/meta';
import skyline from '@/assets/skyline-malam.jpg';

export const Route = createFileRoute('/auth')({ head: () => meta('Masuk', 'Masuk ke Baturaden 25 Homestay.'), component: Auth });

function Auth() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [mode, setMode] = useState<'masuk'|'lupa'|'daftar'>('masuk'); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    if (mode === 'lupa') { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); setError(error?.message ?? 'Jika alamat terdaftar, tautan pengaturan ulang sudah dikirim.'); }
    else if (mode === 'daftar') { const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } }); setError(error?.message ?? 'Periksa email untuk mengonfirmasi akun. Pemilik perlu memberi akses sebelum Anda dapat masuk.'); }
    else { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setError('Alamat email atau kata sandi tidak sesuai.'); else await navigate({ to: '/' }); }
    setBusy(false);
  }
  const input = 'mt-1.5 h-12 w-full rounded-xl border border-gold/30 bg-navy-deep/80 px-4 text-foreground outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15';
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <img src={skyline} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[60%_60%] opacity-70 saturate-[1.15]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/70 to-background/20" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-background" />
      <div className="panel-mewah relative w-full max-w-md space-y-6 p-7 sm:p-9">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
        <div className="text-center">
          <p className="text-[0.65rem] font-semibold tracking-[0.35em] text-gold">MANAJEMEN</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold"><span className="bg-gradient-to-b from-gold-light to-gold bg-clip-text text-transparent">Baturaden 25</span> Homestay</h1>
          <div className="mx-auto mt-3 h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent" />
          <p className="mt-3 font-serif text-sm italic text-gold-light/90">Kenyamanan tenang, layanan sepenuh hati</p>
        </div>
        <h2 className="font-serif text-xl text-gold-light">{mode === 'masuk' ? 'Masuk' : mode === 'lupa' ? 'Lupa kata sandi' : 'Daftar akun'}</h2>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium text-muted-foreground">Alamat email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className={input} /></label>
          {mode !== 'lupa' && <label className="block text-sm font-medium text-muted-foreground">Kata sandi<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} className={input} /></label>}
          {error && <p role="status" className="text-sm text-gold-light">{error}</p>}
          <Button disabled={busy} className="emas-isi h-12 w-full rounded-xl font-semibold">{mode === 'masuk' ? 'Masuk' : mode === 'lupa' ? 'Kirim tautan' : 'Daftar'}</Button>
        </form>
        {mode === 'masuk' && <Button variant="outline" className="h-12 w-full rounded-xl border-gold/30 bg-transparent hover:bg-gold/10" onClick={async () => { const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin }); if (result.error) setError('Tidak dapat masuk dengan Google.'); else if (!result.redirected) await navigate({ to: '/' }); }}>Masuk dengan Google</Button>}
        <div className="flex flex-wrap justify-between gap-4 text-sm">
          <Button variant="link" className="px-0 text-gold" onClick={() => { setError(''); setMode(mode === 'masuk' ? 'lupa' : 'masuk'); }}>{mode === 'masuk' ? 'Lupa kata sandi?' : 'Kembali ke masuk'}</Button>
          {mode === 'masuk' && <Button variant="link" className="px-0 text-gold" onClick={() => { setError(''); setMode('daftar'); }}>Daftar</Button>}
        </div>
      </div>
    </main>
  );
}
