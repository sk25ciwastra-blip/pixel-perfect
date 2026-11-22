import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Archive, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { usePeran } from '@/lib/peran';
import { hapusDataDemo } from '@/lib/owner-delete.functions';

const pesan: Record<string, string> = {
  denied: 'Aksi ini memerlukan sesi Owner yang aktif. Masuk kembali bila sesi berakhir.',
  unavailable: 'Aksi ini belum tersedia.',
  busy: 'Data sedang diproses. Silakan coba lagi.',
  missing: 'Target tidak ditemukan. Muat ulang daftar.',
  confirmation: 'ID atau nomor yang diketik tidak cocok.',
  demo_required: 'Konfirmasikan bahwa target adalah data DEMO.',
  protected_employee: 'Akun Owner dan akun Anda sendiri dilindungi.',
  open_cash: 'Karyawan memiliki sesi kas terbuka.',
  active_training: 'Karyawan memiliki penugasan Training aktif.',
  employee_history: 'Karyawan memiliki tanggung jawab transaksi atau riwayat keuangan.',
  active_transaction: 'Booking atau check-in masih aktif. Gunakan prosedur pembatalan atau check-out yang berlaku.',
  paid_transaction: 'Transaksi memiliki pembayaran. Gunakan Arsip DEMO untuk transaksi historis yang sudah diverifikasi, atau prosedur refund resmi bila diperlukan.',
  demo_unclassified: 'Transaksi ini belum diverifikasi sebagai DEMO. Arsip baru tersedia setelah klasifikasi disetujui.',
  unpaid_transaction: 'Arsip DEMO tersedia untuk transaksi historis yang memiliki pembayaran. Periksa kelayakan Hapus permanen.',
  transaction_reference: 'Transaksi terkait dengan catatan yang harus dipertahankan, seperti struk, refund, atau Housekeeping.',
};

type Props = {
  kind: 'employee' | 'transaction' | 'archive';
  id: string;
  code: string;
  name: string;
  amount?: string;
  onDeleted: () => void;
};

export function TombolHapusDemo({ kind, id, code, name, amount, onDeleted }: Props) {
  const { posisiKode } = usePeran();
  const hapus = useServerFn(hapusDataDemo);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (posisiKode !== 'owner') return null;

  const karyawan = kind === 'employee';
  const arsip = kind === 'archive';
  const aksi = arsip ? 'Arsip DEMO' : karyawan ? 'Hapus' : 'Hapus permanen';
  const valid = confirmation === code && (arsip || demo);
  const changeOpen = (next: boolean) => {
    if (busy) return;
    setOpen(next);
    if (next) {
      setConfirmation('');
      setDemo(false);
      setError('');
    }
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !valid) return;
    setBusy(true);
    setError('');
    try {
      const result = await hapus({ data: { kind, id, confirmation, ...(arsip ? {} : { demoConfirmed: true as const }) } });
      if (result === 'done') {
        setOpen(false);
        onDeleted();
      } else {
        setError(pesan[result ?? ''] ?? 'Aksi belum berhasil. Silakan coba lagi.');
      }
    } catch {
      setError('Permintaan belum dapat dikonfirmasi. Coba lagi dengan target yang sama.');
    } finally {
      setBusy(false);
    }
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild>
      <Button type="button" variant="ghost" size="icon" className={arsip ? 'size-8 shrink-0' : 'size-8 shrink-0 text-destructive'} data-owner-delete={!arsip || undefined}
        aria-label={`${aksi} ${code}`} title={aksi}>{arsip ? <Archive className="size-4" /> : <Trash2 className="size-4" />}</Button>
    </DialogTrigger>
    <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-xl">
      <DialogTitle>{arsip ? 'Arsip DEMO' : `${aksi} ${karyawan ? 'karyawan' : 'transaksi'} DEMO`}</DialogTitle>
      <DialogDescription>
        {arsip ? 'Transaksi akan disembunyikan dari Daftar Transaksi, Booking, dan Dashboard. Keuangan dan Laporan tetap menyertakan riwayatnya, termasuk pembayaran dan saldo. Struk dan Housekeeping tetap tersimpan.'
          : karyawan
          ? 'Akun akan diarsipkan dan akses login dicabut. ID tetap disimpan. Sesi kas atau riwayat keuangan yang terkait akan menghalangi penghapusan.'
          : 'Penghapusan transaksi bersifat permanen. Pembayaran, sesi kas, struk, dan riwayat Housekeeping yang terkait akan menghalangi penghapusan.'}
      </DialogDescription>
      <div className="text-sm">
        <p className="font-semibold">{name}</p>
        <p className="font-mono">{code}</p>
        {amount && <p>{amount}</p>}
      </div>
      <form className="space-y-3" onSubmit={submit}>
        <label className="block text-sm">
          Ketik ulang {karyawan ? 'ID karyawan' : 'nomor transaksi'} persis seperti di atas
          <input value={confirmation} onChange={event => setConfirmation(event.target.value)}
            disabled={busy} autoComplete="off" maxLength={128}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 font-mono" />
        </label>
        {!arsip && <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={demo} disabled={busy} onChange={event => setDemo(event.target.checked)} />
          Saya memastikan ini data DEMO Baturaden 25 Homestay.
        </label>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => changeOpen(false)}>Batal</Button>
          <Button type="submit" variant={arsip ? 'default' : 'destructive'} disabled={busy || !valid}>{busy ? 'Memproses…' : aksi}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
