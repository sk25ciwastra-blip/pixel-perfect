import { useEffect, useState } from 'react';
import logoBaturaden from '@/assets/logo-baturaden-25.png.asset.json';
import '@/components/opening.css';

// Penanda sekali per sesi aktif; opening tidak tampil ulang pada navigasi internal.
const KUNCI = 'b25-opening';
const TOTAL_MS = 4000;
// Jalur cahaya dalam koordinat gambar logo (900×287): kiri bawah → ikon ceklis.
const JALUR = 'M -260 470 C 140 480, 520 390, 815 212';
const EKOR = [
  { panjang: 300, kelas: 'opening-ekor-1' },
  { panjang: 180, kelas: 'opening-ekor-2' },
  { panjang: 80, kelas: 'opening-ekor-3' },
  { panjang: 14, kelas: 'opening-ekor-kepala' },
];

function perluOpening(): boolean {
  try {
    if (sessionStorage.getItem(KUNCI) === '1') return false;
    sessionStorage.setItem(KUNCI, '1');
    return true;
  } catch {
    return false;
  }
}

// Opening aplikasi: logo reveal premium, murni CSS, sekali per sesi.
export function Opening() {
  const [tampil, setTampil] = useState(false);
  const [menutup, setMenutup] = useState(false);

  useEffect(() => {
    if (!perluOpening()) return;
    setTampil(true);
    const t1 = setTimeout(() => setMenutup(true), TOTAL_MS - 350);
    const t2 = setTimeout(() => setTampil(false), TOTAL_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!tampil) return null;

  return (
    <div className="opening-layar" data-menutup={menutup || undefined} aria-hidden="true">
      <div className="opening-kunci">
        <div className="opening-logo-bungkus">
          <img src={logoBaturaden.url} alt="" className="opening-logo opening-logo-dasar" />
          <img src={logoBaturaden.url} alt="" className="opening-logo-ceklis" />
          <svg className="opening-jejak" viewBox="0 0 900 287" aria-hidden="true">
            {EKOR.map((e) => (
              <path
                key={e.kelas}
                d={JALUR}
                pathLength={1000}
                className={`opening-ekor ${e.kelas}`}
                style={{ strokeDasharray: `${e.panjang} 3000`, ['--awal' as string]: `${e.panjang}`, ['--akhir' as string]: `${e.panjang - 1000}` }}
              />
            ))}
          </svg>
          <span className="opening-bola" />
          <span className="opening-kilau-ceklis" />
        </div>
        <div className="opening-manajemen">
          <span className="opening-garis opening-garis-kiri" />
          <span className="opening-kata">MANAJEMEN</span>
          <span className="opening-garis opening-garis-kanan" />
        </div>
      </div>
    </div>
  );
}
