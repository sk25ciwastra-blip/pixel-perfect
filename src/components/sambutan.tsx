import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { ambilSambutan, sapaanUntuk } from '@/lib/sambutan';
import { usePeran } from '@/lib/peran';
import panorama from '@/assets/panorama-kota-malam.png.asset.json';
import logoBaturaden from '@/assets/logo-baturaden-25.png.asset.json';
import karakter from '@/assets/karakter-manajemen.png';
import '@/components/sambutan.css';

const TAHAN_MS = 1200;
const FADE_MS = 320;

function Daun({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      className="sambutan-daun"
      width="20"
      height="28"
      viewBox="0 0 20 28"
      fill="none"
      aria-hidden="true"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path
        d="M10 26 C10 18 10 10 10 2 M10 22 C5 21 3 17 3 13 C7 14 9 17 10 22 Z M10 22 C15 21 17 17 17 13 C13 14 11 17 10 22 Z M10 14 C6 13 4 10 4 6 C8 7 10 10 10 14 Z M10 14 C14 13 16 10 16 6 C12 7 10 10 10 14 Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

export function Sambutan() {
  const { posisiKode } = usePeran();
  const [fase, setFase] = useState<'masuk' | 'tampil' | 'tutup' | 'selesai'>('masuk');
  const timer = useRef<ReturnType<typeof setTimeout>[]>([]);

  const tutup = useCallback(() => {
    setFase((f) => (f === 'tampil' || f === 'masuk' ? 'tutup' : f));
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => setFase('tampil'), 30);
    const t2 = setTimeout(() => setFase('tutup'), 30 + TAHAN_MS);
    const t3 = setTimeout(() => setFase('selesai'), 30 + TAHAN_MS + FADE_MS);
    timer.current = [t1, t2, t3];
    return () => timer.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (fase !== 'tutup') return;
    const t = setTimeout(() => setFase('selesai'), FADE_MS);
    return () => clearTimeout(t);
  }, [fase]);

  useEffect(() => {
    const padaTombol = () => tutup();
    window.addEventListener('keydown', padaTombol);
    return () => window.removeEventListener('keydown', padaTombol);
  }, [tutup]);

  if (fase === 'selesai') return null;

  const sapaan = sapaanUntuk(posisiKode);

  return (
    <div
      className="sambutan-layar"
      data-fase={fase === 'masuk' ? 'masuk' : fase}
      role="status"
      aria-label={`${sapaan.judul} ${sapaan.pesan}`}
      onClick={tutup}
    >
      <img src={panorama.url} alt="" aria-hidden="true" className="sambutan-latar" />
      <div className="sambutan-latar-gelap" />

      <div className="sambutan-bingkai">
        <div className="sambutan-panel">
          <div className="sambutan-karakter">
            <img src={karakter} alt="" aria-hidden="true" />
            <span className="sambutan-papan-nama">{sapaan.label}</span>
          </div>

          <div className="sambutan-isi">
            <img src={logoBaturaden.url} alt="Baturaden 25 Homestay" className="sambutan-logo" />
            <p className="sambutan-manajemen">MANAJEMEN</p>
            <h1 className="sambutan-judul">{sapaan.judul}</h1>
            <div className="sambutan-garis" aria-hidden="true" />
            <Bell className="sambutan-lonceng" size={34} strokeWidth={1.8} aria-hidden="true" />
            <div className="sambutan-pesan">
              <Daun />
              <p>{sapaan.pesan}</p>
              <Daun flip />
            </div>
            <p className="sambutan-berhasil">
              <CheckCircle2 size={20} aria-hidden="true" />
              Login berhasil
            </p>
            <div className="sambutan-titik" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p className="sambutan-lewati">Klik atau tekan tombol apa saja untuk melanjutkan</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Dipanggil dari gerbang akses: true hanya sekali tepat setelah login berhasil.
export function perluSambutan(): boolean {
  return ambilSambutan();
}
