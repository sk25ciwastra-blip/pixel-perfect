import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Mail, Lock, LogIn, Building2, Check } from 'lucide-react';
import { meta } from '@/lib/meta';
// Panorama unggahan sebelumnya dipilih kembali oleh Owner; lokasi belum terverifikasi.
import panorama from '@/assets/panorama-kota-malam.png.asset.json';
import logoBaturaden from '@/assets/logo-baturaden-25.png.asset.json';

export const Route = createFileRoute('/auth')({ head: () => meta('Masuk', 'Masuk ke Baturaden 25 Homestay.'), component: Auth });

function Auth() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [mode, setMode] = useState<'masuk'|'lupa'|'daftar'>('masuk'); const [busy, setBusy] = useState(false); const [lihat, setLihat] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    if (mode === 'lupa') { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); setError(error?.message ?? 'Jika alamat terdaftar, tautan pengaturan ulang sudah dikirim.'); }
    else if (mode === 'daftar') { const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } }); setError(error?.message ?? 'Periksa email untuk mengonfirmasi akun. Pemilik perlu memberi akses sebelum Anda dapat masuk.'); }
    else { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setError('Alamat email atau kata sandi tidak sesuai.'); else { await navigate({ to: '/' }); } }
    setBusy(false);
  }
  const input = 'h-10 w-full rounded-xl border border-gold/70 bg-gradient-to-b from-background/90 to-navy-deep/80 pl-12 pr-4 text-[14px] text-foreground placeholder:text-foreground/70 shadow-[inset_0_2px_6px_color-mix(in_oklch,var(--background)_80%,transparent)] outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/20';
  const lupa = mode === 'lupa';
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <img src={panorama.url} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/45 via-transparent to-background/50" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,color-mix(in_oklch,var(--background)_55%,transparent))]" />

      <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-4">
        <div aria-label="Baturaden 25 Homestay" className="mb-2 text-center">
          <img src={logoBaturaden.url} alt="Baturaden 25 Homestay" width={900} height={287} className="mx-auto block h-auto w-[170px] drop-shadow-[0_4px_14px_color-mix(in_oklch,var(--background)_90%,transparent)]" />
          <div className="mt-1 flex items-center justify-center gap-2">
            <span className="h-px w-6 bg-gold/80" />
            <span className="text-[0.62rem] font-bold tracking-[0.32em] text-gold">MANAJEMEN</span>
            <span className="h-px w-6 bg-gold/80" />
          </div>
        </div>

        <div className="relative w-full max-w-[540px]">
          {/* Bingkai emas melengkung */}
          <div className="rounded-[2.5rem] bg-gradient-to-b from-gold-light via-gold-dark to-gold p-[3px] shadow-[0_0_45px_-8px_color-mix(in_oklch,var(--gold)_60%,transparent),0_35px_70px_-20px_color-mix(in_oklch,var(--background)_100%,transparent)]">
            <div className="relative rounded-[2.35rem] bg-gradient-to-b from-navy-deep via-background to-background px-5 pb-5 pt-6 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--gold-light)_40%,transparent),inset_0_0_40px_color-mix(in_oklch,var(--gold)_8%,transparent)] sm:px-9 sm:pt-6">
              <div className="pointer-events-none absolute left-1/2 top-0 h-24 w-3/4 -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/80" />
                <p className="shrink-0 text-center text-[13px] font-semibold italic text-gold sm:text-[15px]">Senyum Tamu Dimulai dari Sistem yang Tepat</p>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/80" />
              </div>
              <h1 className="mt-3 text-center text-[26px] font-extrabold leading-tight text-foreground sm:text-[30px]">Selamat Datang Kembali</h1>
              <p className="mt-1 text-center text-[15px] text-foreground/90 sm:text-base">{lupa ? 'Atur ulang password akun Anda' : 'Masuk ke Sistem Baturaden 25 Homestay'}</p>

              <form onSubmit={submit} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="login-email" className="flex items-center gap-3 text-[15px] font-bold text-foreground"><Mail className="h-5 w-5 text-gold" />Email Karyawan</label>
                  <div className="relative mt-1.5">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gold" />
                    <input id="login-email" required type="email" autoComplete="username" placeholder="nama@email.com" aria-describedby="petunjuk-email" value={email} onChange={e => setEmail(e.target.value)} className={input} />
                  </div>
                  <p id="petunjuk-email" className="mt-1.5 pl-6 text-[13px] text-foreground/85">Gunakan email yang terdaftar pada akun karyawan.</p>
                </div>
                {!lupa && (
                  <div>
                    <label htmlFor="login-password" className="flex items-center gap-3 text-[15px] font-bold text-foreground"><Lock className="h-5 w-5 text-gold" />Password</label>
                    <div className="relative mt-1.5">
                      <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gold" />
                      <input id="login-password" required minLength={8} type={lihat ? 'text' : 'password'} autoComplete="current-password" placeholder="Masukkan password" value={password} onChange={e => setPassword(e.target.value)} className={`${input} pr-12`} />
                      <button type="button" onClick={() => setLihat(v => !v)} aria-label={lihat ? 'Sembunyikan password' : 'Tampilkan password'} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-gold hover:bg-gold/10">
                        {lihat ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <button type="button" onClick={() => { setMode(lupa ? 'masuk' : 'lupa'); setError(''); }} className="text-[14px] font-bold text-gold hover:underline">{lupa ? 'Kembali ke Masuk' : 'Lupa password?'}</button>
                </div>
                {!lupa && (
                  <div className="flex items-start gap-3">
                    <span aria-hidden="true" className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-gold text-background"><Check className="h-4 w-4" strokeWidth={3} /></span>
                    <div>
                      <p className="text-[15px] font-bold text-foreground">Ingat saya</p>
                      <p className="text-[13px] text-foreground/85">Sesi tersimpan otomatis di perangkat ini untuk memudahkan akses.</p>
                    </div>
                  </div>
                )}
                {error && <p role="status" className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-sm text-gold-light">{error}</p>}
                <button disabled={busy} className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-gold-light via-gold to-gold-dark text-lg font-extrabold text-background shadow-[inset_0_1px_0_color-mix(in_oklch,var(--foreground)_50%,transparent),0_8px_24px_-8px_color-mix(in_oklch,var(--gold)_70%,transparent)] transition hover:brightness-110 disabled:opacity-70">
                  <LogIn className="h-6 w-6" />{busy ? 'Memproses…' : lupa ? 'Kirim Tautan' : 'Masuk'}
                </button>
              </form>

              <div className="mt-4 flex items-center gap-4 rounded-2xl border border-gold/70 bg-gradient-to-b from-gold/10 to-transparent px-5 py-2.5">
                <Mail className="h-9 w-9 shrink-0 text-gold" strokeWidth={1.6} />
                <span className="h-10 w-px shrink-0 bg-gold/60" />
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-foreground">Baru bergabung?</p>
                  <p className="text-[13px] leading-snug text-foreground/85">Periksa email undangan dari Baturaden 25 Homestay untuk membuat password akun Anda.</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/70" />
                <p className="flex items-center gap-2 text-[15px] font-bold text-foreground"><Building2 className="h-5 w-5 text-gold" />Baturaden 25 Homestay</p>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/70" />
              </div>
              <p className="mt-2 text-center text-[13px] text-foreground/85">Kamar <span className="text-gold">•</span> Tamu <span className="text-gold">•</span> Transaksi <span className="text-gold">•</span> Kas <span className="text-gold">•</span> Tim</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
