import { createFileRoute } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Kerangka } from '@/components/kerangka';
import { SubPengaturan } from '@/components/pengaturan-sub';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { changeOwnPassword } from '@/lib/own-password';
import { meta } from '@/lib/meta';

export const Route = createFileRoute('/pengaturan-keamanan')({
  head: () => meta('Keamanan Akun', 'Ganti password akun sendiri di Baturaden 25 Homestay.'),
  component: KeamananAkun,
});

const inputClass = 'mt-1.5 h-11 w-full rounded-lg border border-input bg-background/70 px-3 text-sm text-foreground outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30';

function KeamananAkun() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await changeOwnPassword(supabase.auth, {
        currentPassword, newPassword, confirmPassword,
      });
      setNotice(result);
      // Jangan mempertahankan password lama setelah percobaan verifikasi.
      setCurrentPassword('');
      if (result.ok) {
        setNewPassword('');
        setConfirmPassword('');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Kerangka judul="Pengaturan" keterangan="Keamanan akun pribadi Baturaden 25 Homestay.">
      <SubPengaturan>
        <section className="panel-mewah mx-auto max-w-2xl p-5 sm:p-7" aria-labelledby="judul-keamanan">
          <div className="mb-5 flex items-start gap-3">
            <span className="ikon-bulat flex size-11 shrink-0 items-center justify-center text-gold">
              <KeyRound size={22} aria-hidden="true" />
            </span>
            <div>
              <h1 id="judul-keamanan" className="font-serif text-xl font-bold">Ubah Password</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Hanya password akun yang sedang Anda gunakan yang dapat diubah.
              </p>
            </div>
          </div>

          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            <label htmlFor="password-saat-ini" className="block text-sm font-semibold">
              Password saat ini
              <input
                id="password-saat-ini"
                name="current-password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                disabled={busy}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className={inputClass}
              />
            </label>
            <label htmlFor="password-baru" className="block text-sm font-semibold">
              Password baru
              <input
                id="password-baru"
                name="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={newPassword}
                disabled={busy}
                onChange={(event) => setNewPassword(event.target.value)}
                className={inputClass}
              />
            </label>
            <label htmlFor="konfirmasi-password" className="block text-sm font-semibold">
              Konfirmasi password baru
              <input
                id="konfirmasi-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                disabled={busy}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={inputClass}
              />
            </label>

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
              Gunakan minimal 8 karakter. Password saat ini diverifikasi terlebih dahulu.
              Jangan memberikan password kepada Owner maupun karyawan lain.
            </p>
            {notice && (
              <p role={notice.ok ? 'status' : 'alert'}
                className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
                {notice.message}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Memverifikasi…' : 'Simpan Password Baru'}
            </Button>
          </form>
        </section>
      </SubPengaturan>
    </Kerangka>
  );
}
