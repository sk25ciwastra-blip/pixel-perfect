import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { meta } from '@/lib/meta';
import skyline from '@/assets/surapati-bandung-malam.jpg';

export const Route = createFileRoute('/auth')({ head: () => meta('Masuk', 'Masuk ke Baturaden 25 Homestay.'), component: Auth });

function Auth() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [mode] = useState<'masuk'|'lupa'|'daftar'>('masuk'); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    if (mode === 'lupa') { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); setError(error?.message ?? 'Jika alamat terdaftar, tautan pengaturan ulang sudah dikirim.'); }
    else if (mode === 'daftar') { const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } }); setError(error?.message ?? 'Periksa email untuk mengonfirmasi akun. Pemilik perlu memberi akses sebelum Anda dapat masuk.'); }
    else { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setError('Alamat email atau kata sandi tidak sesuai.'); else await navigate({ to: '/' }); }
    setBusy(false);
  }
  const input = 'mt-2.5 h-12 w-full rounded-xl border border-gold/25 bg-navy-deep/80 px-4 text-sm font-normal normal-case text-foreground outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15';
  const logo = <div aria-label="Baturaden 25 Homestay" className="w-fit text-center leading-tight">
    <svg viewBox="0 0 64 40" className="mx-auto mb-2 h-9 w-14 text-gold" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M32 4c5 6 6 14 0 24C26 18 27 10 32 4Z" />
      <path d="M32 28c-4-8-10-13-19-14 0 9 8 15 19 14Z" />
      <path d="M32 28c4-8 10-13 19-14 0 9-8 15-19 14Z" />
      <path d="M32 30c-8 2-17 0-24-6 6 7 15 10 24 9 9 1 18-2 24-9-7 6-16 8-24 6Z" />
      <path d="M14 36h36" strokeOpacity="0.6" />
    </svg>
    <p className="font-serif text-2xl text-foreground">Baturaden <span className="text-gold-light">25</span></p>
    <p className="font-serif text-2xl text-foreground">Homestay</p>
    <div className="mx-auto mt-2 flex items-center justify-center gap-2"><span className="h-px w-6 bg-gradient-to-r from-transparent to-gold" /><span className="text-[0.55rem] font-semibold text-gold">MANAJEMEN</span><span className="h-px w-6 bg-gradient-to-l from-transparent to-gold" /></div>
  </div>;
  return (
    <main className="relative grid min-h-screen bg-background text-foreground lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      {/* Panel suasana malam */}
      <section className="relative hidden overflow-hidden lg:block">
        <img src={skyline} alt="" aria-hidden="true" width={1536} height={1024} className="absolute inset-0 h-full w-full object-cover object-[60%_50%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-background/25" />
        <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-r from-transparent to-background" />
        <div className="relative flex h-full flex-col justify-between p-12">
          {logo}
          <div className="max-w-md">
            <div className="mb-5 h-px w-16 bg-gradient-to-r from-gold to-transparent" />
            <h2 className="font-serif text-5xl leading-[1.1] text-foreground">Setiap malam,<br /><span className="italic text-gold-light">tamu pulang tenang.</span></h2>
          </div>
        </div>
      </section>

      {/* Formulir */}
      <section className="relative flex items-center justify-center overflow-hidden px-5 py-10 sm:px-10">
        <img src={skyline} alt="" aria-hidden="true" width={1536} height={1024} className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[65%_50%] opacity-60 lg:hidden" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background lg:hidden" />
        <div className="relative w-full max-w-[400px]">
          <div className="mb-8 flex justify-center lg:hidden">{logo}</div>
          <div className="panel-mewah space-y-7 p-7 sm:p-10">
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
            <div>
              <p className="mb-3 text-[0.65rem] font-semibold text-gold">BATURADEN 25 HOMESTAY</p>
              <h1 className="font-serif text-3xl leading-tight text-foreground">Selamat datang kembali</h1>
              <p className="mt-3 text-sm text-muted-foreground">Silakan masuk ke akun Anda.</p>
            </div>
            <form onSubmit={submit} className="space-y-5">
              <label className="block text-xs font-semibold text-gold-light">Username<input required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className={input} /></label>
              {mode !== 'lupa' && <label className="block text-xs font-semibold text-gold-light">Password<input required minLength={8} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={input} /></label>}
              {error && <p role="status" className="rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-sm text-gold-light">{error}</p>}
              <Button disabled={busy} className="h-12 w-full rounded-xl">{busy ? 'Memproses…' : 'Masuk'}</Button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
