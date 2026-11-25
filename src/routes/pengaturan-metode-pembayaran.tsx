import { createFileRoute, Link } from '@tanstack/react-router';
import { CreditCard, Wallet, Landmark, ScanLine, ShieldAlert } from 'lucide-react';
import { Kerangka } from '@/components/kerangka';
import { SubPengaturan } from '@/components/pengaturan-sub';
import { useTable } from '@/lib/data-live';
import { usePeran } from '@/lib/peran';
import { featureFlags } from '@/lib/feature-flags';
import { meta } from '@/lib/meta';

export const Route = createFileRoute('/pengaturan-metode-pembayaran')({
  head: () => meta('Metode Pembayaran', 'Metode yang digunakan Baturaden 25 Homestay.'),
  component: HalamanMetodePembayaran,
});

function HalamanMetodePembayaran() {
  const { posisiKode, siap, training } = usePeran();
  const owner = siap && posisiKode === 'owner' && !training.is_training;
  const banks = useTable('finance_bank_accounts', owner);
  if (!siap) return <Kerangka judul="Metode Pembayaran"><SubPengaturan><p>Memeriksa akses…</p></SubPengaturan></Kerangka>;
  if (!owner) return <Kerangka judul="Metode Pembayaran"><SubPengaturan><p role="alert">Halaman ini khusus Owner.</p></SubPengaturan></Kerangka>;

  const activeBankCount = banks.rows.filter(b => b.active).length;
  return (
    <Kerangka judul="Metode Pembayaran" keterangan="Tinjau metode pembayaran dan pengaturan yang sudah didukung sistem.">
      <SubPengaturan>
        <section className="panel-mewah mx-auto max-w-3xl space-y-5 p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="ikon-bulat flex size-11 items-center justify-center text-gold"><CreditCard size={22} aria-hidden="true" /></span>
            <div>
              <h1 className="font-serif text-xl font-bold">Metode Pembayaran</h1>
              <p className="text-sm text-muted-foreground">Cash, QRIS, dan Transfer mengikuti alur pembayaran resmi aplikasi.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <Wallet className="mb-2 text-gold" size={22} aria-hidden="true" />
              <h2 className="font-semibold">Cash</h2>
              <p className="mt-1 text-xs text-muted-foreground">Penerimaan tunai dicatat pada sesi kas sesuai kewenangan operator.</p>
            </div>
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <ScanLine className="mb-2 text-gold" size={22} aria-hidden="true" />
              <h2 className="font-semibold">QRIS</h2>
              <p className="mt-1 text-xs text-muted-foreground">QRIS resmi digunakan pada alur transaksi. Penggantian QRIS belum dikelola dari halaman ini.</p>
            </div>
            <div className="rounded-xl border border-border bg-background/70 p-4">
              <Landmark className="mb-2 text-gold" size={22} aria-hidden="true" />
              <h2 className="font-semibold">Transfer</h2>
              {banks.loading ? <p className="mt-1 text-xs">Memuat rekening…</p> :
                banks.error ? <p role="alert" className="mt-1 text-xs text-destructive">Data rekening belum dapat dibaca.</p> :
                <p className="mt-1 text-xs text-muted-foreground">{activeBankCount} rekening Owner aktif.</p>}
              <Link to="/pengaturan-keuangan" className="mt-3 inline-block text-sm font-semibold text-gold underline underline-offset-4">Kelola Rekening Owner</Link>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background/50 p-4 text-sm">
            <h2 className="font-semibold">Pembayaran menggunakan dua metode</h2>
            <p className="mt-1 text-muted-foreground">
              {featureFlags.combinedPayment
                ? 'Fitur pembayaran gabungan diaktifkan oleh seluruh gerbang fitur. Penerimaan tetap harus melewati validasi backend.'
                : 'Fitur pembayaran gabungan saat ini belum aktif menurut gerbang aplikasi. Pilihan metode tetap mengikuti mekanisme tunggal yang berlaku.'}
            </p>
          </div>
          <p role="note" className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            Halaman ini tidak mengubah kanal pembayaran yang diizinkan, rekening, QRIS, atau feature flag secara diam-diam. Pengaturan aktif/nonaktif metode membutuhkan validasi server dan persetujuan rilis terpisah.
          </p>
        </section>
      </SubPengaturan>
    </Kerangka>
  );
}
