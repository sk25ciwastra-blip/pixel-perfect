import { createFileRoute } from '@tanstack/react-router';
import { Banknote, CreditCard, QrCode, ShieldCheck, Landmark, Info } from 'lucide-react';
import { Kerangka } from '@/components/kerangka';
import { SubPengaturan } from '@/components/pengaturan-sub';
import { usePeran } from '@/lib/peran';
import { featureFlags } from '@/lib/feature-flags';
import { meta } from '@/lib/meta';
import './pengaturan-metode-pembayaran.css';

export const Route = createFileRoute('/pengaturan-metode-pembayaran')({
  head: () => meta('Metode Pembayaran', 'Metode pembayaran yang tersedia dalam aplikasi Baturaden 25 Homestay.'),
  component: MetodePembayaran,
});

const metode = [
  { name: 'Cash', icon: Banknote, note: 'Pembayaran tunai yang dicatat dalam sesi kas operasional.' },
  { name: 'QRIS', icon: QrCode, note: 'Pembayaran melalui QRIS resmi homestay.' },
  { name: 'Transfer', icon: Landmark, note: 'Transfer bank ke rekening resmi yang ditetapkan Owner.' },
] as const;

function MetodePembayaran() {
  const { siap, posisiKode, training } = usePeran();
  const owner = siap && posisiKode === 'owner' && !training.is_training;
  if (!siap) return <Kerangka judul="Metode Pembayaran"><SubPengaturan><p>Memeriksa akses…</p></SubPengaturan></Kerangka>;
  if (!owner) return <Kerangka judul="Metode Pembayaran"><SubPengaturan><p role="alert">Halaman ini khusus Owner.</p></SubPengaturan></Kerangka>;

  return (
    <Kerangka judul="Metode Pembayaran" keterangan="Informasi metode pembayaran resmi Baturaden 25 Homestay.">
      <SubPengaturan>
        <section className="pm-owner-page panel-mewah mx-auto max-w-2xl p-5 sm:p-7" aria-labelledby="judul-metode">
          <div className="mb-5 flex items-start gap-3">
            <span className="ikon-bulat flex size-11 shrink-0 items-center justify-center text-gold"><CreditCard size={22} aria-hidden="true" /></span>
            <div>
              <h1 id="judul-metode" className="font-serif text-xl font-bold">Metode Pembayaran</h1>
              <p className="mt-1 text-sm text-muted-foreground">Daftar kanal pembayaran yang dikenali dalam formulir transaksi aplikasi.</p>
            </div>
          </div>
          <div className="space-y-3">
            {metode.map(item => <div key={item.name} className="pm-owner-row flex items-start gap-3 rounded-xl p-4">
              <span className="pm-owner-icon flex size-10 shrink-0 items-center justify-center rounded-lg"><item.icon className="size-5 text-gold" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <p className="pm-owner-name font-semibold">{item.name}</p>
                <p className="pm-owner-note mt-1 text-xs leading-relaxed">{item.note}</p>
              </div>
              <span className="pm-owner-label shrink-0 rounded-full px-2 py-1 text-[10px]">Tersedia di formulir</span>
            </div>)}
          </div>
          <div className="pm-owner-info mt-5 rounded-xl p-4 text-sm">
            <p className="pm-owner-info-title flex items-start gap-2 font-semibold"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />Pilihan pembayaran gabungan</p>
            <p className="mt-1 text-xs leading-relaxed">{featureFlags.combinedPayment
              ? 'Dukungan pembayaran gabungan mengikuti fitur yang sudah aktif pada formulir transaksi. Maksimal dua metode sesuai aturan yang berlaku.'
              : 'Pembayaran gabungan mengikuti pengaturan rilis aplikasi dan belum diaktifkan dari halaman ini.'}</p>
          </div>
          <p className="pm-owner-footnote mt-4 flex items-start gap-2 text-xs leading-relaxed">
            <Info className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
            Halaman ini menampilkan konfigurasi metode yang sudah didukung aplikasi. Belum ada backend resmi untuk mengaktifkan/menonaktifkan masing-masing metode dari Pengaturan; karena itu tidak ditampilkan sakelar palsu. Pengaturan rekening transfer dilakukan pada menu Rekening Owner.
          </p>
        </section>
      </SubPengaturan>
    </Kerangka>
  );
}
