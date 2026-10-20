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
  const input = 'mt-1.5 h-12 w-full rounded-xl border border-gold/25 bg-navy-deep/80 px-4 text-foreground outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15';
  return (
    <main className="relative grid min-h-screen bg-background text-foreground lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* Panel suasana malam */}
      <section className="relative hidden overflow-hidden lg:block">
        <img src={skyline} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-[55%_60%] saturate-[1.15]" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/10" />
        <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-r from-transparent to-background" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <p className="text-[0.65rem] font-semibold tracking-[0.4em] text-gold">BATURADEN 25 HOMESTAY</p>
          <div className="max-w-md">
            <div className="mb-5 h-px w-16 bg-gradient-to-r from-gold to-transparent" />
            <h2 className="font-serif text-5xl leading-[1.1] text-foreground">Setiap malam,<br /><span className="italic text-gold-light">tamu pulang tenang.</span></h2>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">Ruang kerja harian tim Baturaden 25 Homestay — kamar, tamu, transaksi, dan kas dalam satu tempat.</p>
          </div>
        </div>
      </section>

      {/* Formulir */}
      <section className="relative flex items-center justify-center overflow-hidden px-5 py-10 sm:px-10">
        <img src={skyline} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40 lg:hidden" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background lg:hidden" />
        <div className="relative w-full max-w-[400px]">
          <div className="mb-8">
            <p className="text-[0.65rem] font-semibold tracking-[0.35em] text-gold">MANAJEMEN</p>
            <h1 className="mt-2 font-serif text-[2rem] leading-tight"><span className="bg-gradient-to-b from-gold-light to-gold bg-clip-text text-transparent">Baturaden 25</span> Homestay</h1>
            <p className="mt-2 font-serif text-sm italic text-gold-light/85">Kenyamanan tenang, layanan sepenuh hati</p>
          </div>
          <div className="panel-mewah space-y-5 p-6 sm:p-8">
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
            <div>
              <h2 className="font-serif text-2xl text-foreground">{mode === 'masuk' ? 'Selamat datang kembali' : mode === 'lupa' ? 'Lupa kata sandi' : 'Daftar akun'}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{mode === 'masuk' ? 'Masuk untuk memulai shift Anda.' : mode === 'lupa' ? 'Kami kirimkan tautan ke email Anda.' : 'Pemilik akan memberi akses setelah pendaftaran.'}</p>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-gold">Alamat email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className={input} /></label>
              {mode !== 'lupa' && <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-gold">Kata sandi<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} className={input} /></label>}
              {error && <p role="status" className="rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-sm text-gold-light">{error}</p>}
              <Button disabled={busy} className="h-12 w-full rounded-xl">{mode === 'masuk' ? 'Masuk' : mode === 'lupa' ? 'Kirim tautan' : 'Daftar'}</Button>
            </form>
            {mode === 'masuk' && <>
              <div className="flex items-center gap-3 text-[0.65rem] tracking-[0.25em] text-muted-foreground"><span className="h-px flex-1 bg-border" />ATAU<span className="h-px flex-1 bg-border" /></div>
              <Button variant="outline" className="h-12 w-full rounded-xl" onClick={async () => { const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin }); if (result.error) setError('Tidak dapat masuk dengan Google.'); else if (!result.redirected) await navigate({ to: '/' }); }}>Masuk dengan Google</Button>
            </>}
            <div className="flex flex-wrap justify-between gap-4 text-sm">
              <Button variant="link" className="h-auto px-0 text-gold" onClick={() => { setError(''); setMode(mode === 'masuk' ? 'lupa' : 'masuk'); }}>{mode === 'masuk' ? 'Lupa kata sandi?' : 'Kembali ke masuk'}</Button>
              {mode === 'masuk' && <Button variant="link" className="h-auto px-0 text-gold" onClick={() => { setError(''); setMode('daftar'); }}>Daftar</Button>}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
