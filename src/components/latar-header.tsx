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
const temaHeader: Record<string, { tema: string; gambar: string }> = {
  '/booking': { tema: 'braga', gambar: booking },
  '/tamu': { tema: 'anyaman', gambar: tamu },
  '/kamar': { tema: 'kayu', gambar: kamar },
  '/transaksi': { tema: 'geometris', gambar: transaksi },
  '/keuangan': { tema: 'art-deco', gambar: keuangan },
  '/housekeeping': { tema: 'linen', gambar: housekeeping },
  '/laporan': { tema: 'priangan', gambar: laporan },
  '/karyawan': { tema: 'ukiran', gambar: tim },
  '/pengaturan': { tema: 'pendopo', gambar: pengaturan },
};

export function LatarHeader({ path }: { path: string; dashboard?: boolean }) {
  const latar = temaHeader[path];
  if (!latar) return null;
  return <div aria-hidden="true" data-header-tema={latar.tema} className="latar-priangan latar-priangan-foto pointer-events-none absolute inset-0 overflow-hidden">
    <img src={latar.gambar} alt="" width={1536} height={512} className="absolute inset-0 h-full w-full object-contain object-right" />
    <div className="selubung-priangan absolute inset-0" />
  </div>;
}