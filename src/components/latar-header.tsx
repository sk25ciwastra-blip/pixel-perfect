import booking from '@/assets/header-booking.jpg';
import tamu from '@/assets/header-tamu-jaipong.jpg';
import kamar from '@/assets/header-kamar.jpg';
import transaksi from '@/assets/header-transaksi.jpg';
import keuangan from '@/assets/header-keuangan.jpg';
import housekeeping from '@/assets/header-housekeeping-kasur.jpg';
import laporan from '@/assets/header-laporan-analisis.jpg';
import tim from '@/assets/header-tim.jpg';
import pengaturan from '@/assets/header-pengaturan-meeting.jpg';

// Illustrative scenery and materials, never photographs of the actual business.
// Dashboard intentionally stays outside this mapping and keeps its own panorama.
const temaHeader: Record<string, { tema: string; gambar: string; posisi: string }> = {
  '/booking': { tema: 'braga', gambar: booking, posisi: 'object-[60%_50%] lg:object-[50%_50%]' },
  '/tamu': { tema: 'anyaman', gambar: tamu, posisi: 'object-[58%_55%] lg:object-[50%_55%]' },
  '/kamar': { tema: 'kayu', gambar: kamar, posisi: 'object-[65%_55%] lg:object-[50%_55%]' },
  '/transaksi': { tema: 'geometris', gambar: transaksi, posisi: 'object-[60%_60%] lg:object-[50%_60%]' },
  '/keuangan': { tema: 'art-deco', gambar: keuangan, posisi: 'object-[65%_60%] lg:object-[50%_60%]' },
  '/housekeeping': { tema: 'linen', gambar: housekeeping, posisi: 'object-[62%_50%] lg:object-[50%_50%]' },
  '/laporan': { tema: 'priangan', gambar: laporan, posisi: 'object-[60%_55%] lg:object-[50%_55%]' },
  '/karyawan': { tema: 'ukiran', gambar: tim, posisi: 'object-[65%_50%] lg:object-[50%_50%]' },
  '/pengaturan': { tema: 'pendopo', gambar: pengaturan, posisi: 'object-[60%_45%] lg:object-[50%_45%]' },
};

export function LatarHeader({ path }: { path: string; dashboard?: boolean }) {
  const latar = temaHeader[path];
  if (!latar) return null;
  return <div aria-hidden="true" data-header-tema={latar.tema} className="latar-priangan latar-priangan-foto pointer-events-none absolute inset-0 overflow-hidden">
    <img src={latar.gambar} alt="" width={1536} height={512} className={`absolute inset-0 h-full w-full object-cover ${latar.posisi}`} />
    <div className="selubung-priangan absolute inset-0" />
  </div>;
}