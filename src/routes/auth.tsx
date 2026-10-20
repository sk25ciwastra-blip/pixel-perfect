import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { meta } from '@/lib/meta';
// Latar: foto asli malam pusat Kota Bandung (Wikimedia Commons, "Bandung city centre - evening cropped.jpg",
// 3016×1508, CC BY-SA 2.0 — Frans.global; ditampilkan utuh dengan lapisan gelap hitam-emas).
import fotoBandung from '@/assets/bandung-malam-login.jpg';

export const Route = createFileRoute('/auth')({ head: () => meta('Masuk', 'Masuk ke Baturaden 25 Homestay.'), component: Auth });

function Auth() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [mode] = useState<'masuk'|'lupa'|'daftar'>('masuk'); const [busy, setBusy] = useState(false); const [lihat, setLihat] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    if (mode === 'lupa') { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); setError(error?.message ?? 'Jika alamat terdaftar, tautan pengaturan ulang sudah dikirim.'); }
    else if (mode === 'daftar') { const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } }); setError(error?.message ?? 'Periksa email untuk mengonfirmasi akun. Pemilik perlu memberi akses sebelum Anda dapat masuk.'); }
    else { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setError('Alamat email atau kata sandi tidak sesuai.'); else await navigate({ to: '/' }); }
    setBusy(false);
  }
  const input = 'mt-2.5 h-12 w-full rounded-xl border border-gold/25 bg-navy-deep/80 px-4 text-sm font-normal normal-case text-foreground outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15';
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Latar penuh: malam Kota Bandung */}
      <img src={fotoBandung} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/75 via-background/45 to-background/90" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_15%,var(--background)_90%)] opacity-85" />

      <div className="relative grid h-svh min-h-[740px] grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] justify-items-center px-5 py-6 sm:px-10">
        {/* Logo resmi Baturaden 25 Homestay */}
        <div aria-label="Baturaden 25 Homestay" className="mb-4 w-fit self-end text-center leading-tight">
          <svg viewBox="0 0 64 40" className="mx-auto mb-2 h-10 w-[4.5rem] text-gold drop-shadow-[0_0_12px_color-mix(in_oklch,var(--gold)_50%,transparent)]" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <path d="M32 4c5 6 6 14 0 24C26 18 27 10 32 4Z" />
            <path d="M32 28c-4-8-10-13-19-14 0 9 8 15 19 14Z" />
            <path d="M32 28c4-8 10-13 19-14 0 9-8 15-19 14Z" />
            <path d="M32 30c-8 2-17 0-24-6 6 7 15 10 24 9 9 1 18-2 24-9-7 6-16 8-24 6Z" />
            <path d="M14 36h36" strokeOpacity="0.6" />
          </svg>
          <p className="font-serif text-2xl text-foreground">Baturaden <span className="text-gold-light">25</span></p>
          <p className="font-serif text-2xl text-foreground">Homestay</p>
          <div className="mx-auto mt-3 flex items-center justify-center gap-2"><span className="h-px w-8 bg-gradient-to-r from-transparent to-gold" /><span className="text-[0.6rem] font-semibold text-gold">MANAJEMEN</span><span className="h-px w-8 bg-gradient-to-l from-transparent to-gold" /></div>
        </div>

        {/* Formulir masuk di tengah */}
        <div className="relative w-full max-w-[420px]">
          <div className="pointer-events-none absolute -inset-px rounded-[1.2rem] bg-gradient-to-b from-gold/60 via-gold/10 to-gold/40 opacity-70 blur-[2px]" />
          <div className="panel-mewah space-y-6 bg-background/55 p-7 shadow-[0_0_60px_-15px_color-mix(in_oklch,var(--gold)_45%,transparent)] backdrop-blur-xl sm:p-9">
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
            <div className="text-center">
              <p className="mb-2 font-serif text-sm italic text-gold-light/85">Setiap malam, pelayanan terbaik menanti.</p>
              <h1 className="font-serif text-2xl leading-tight text-foreground">Selamat datang kembali</h1>
            </div>
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gold-light">Username<input required type="email" autoComplete="username" placeholder="Masukkan username" aria-describedby="petunjuk-username" value={email} onChange={e => setEmail(e.target.value)} className={input} /></label>
                <p id="petunjuk-username" className="mt-2 text-xs text-muted-foreground">Gunakan email akun</p>
              </div>
              <label className="block text-xs font-semibold text-gold-light">Password
                <span className="relative block">
                  <input required minLength={8} type={lihat ? 'text' : 'password'} autoComplete="current-password" placeholder="Masukkan password" value={password} onChange={e => setPassword(e.target.value)} className={`${input} pr-12`} />
                  <button type="button" onClick={() => setLihat(v => !v)} aria-label={lihat ? 'Sembunyikan password' : 'Tampilkan password'} className="absolute right-2 top-1/2 mt-1 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-gold-light/80 transition hover:text-gold-light">
                    {lihat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
              </label>
              <div>
                <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <input type="checkbox" checked disabled aria-describedby="petunjuk-sesi" className="h-4 w-4 rounded accent-gold" />
                  Ingat saya
                </label>
                <p id="petunjuk-sesi" className="mt-2 text-xs leading-relaxed text-muted-foreground">Sesi tersimpan otomatis. Pilihan penyimpanan sesi belum dapat diubah.</p>
              </div>
              {error && <p role="status" className="rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-sm text-gold-light">{error}</p>}
              <Button disabled={busy} className="h-12 w-full rounded-xl text-base">{busy ? 'Memproses…' : 'Masuk'}</Button>
            </form>
          </div>
        </div>

        <p className="mt-6 max-w-md self-start text-center text-xs leading-relaxed text-muted-foreground">Ruang kerja harian tim Baturaden 25 Homestay — kamar, tamu, transaksi, dan kas dalam satu tempat.</p>
      </div>
    </main>
  );
}
