import { useEffect, useState } from 'react';
import logoBaturaden from '@/assets/logo-baturaden-25.png.asset.json';
import '@/components/opening.css';

// Penanda sekali per sesi aktif; opening tidak tampil ulang pada navigasi internal.
const KUNCI = 'b25-opening';
const TOTAL_MS = 2000;

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
        <img src={logoBaturaden.url} alt="" className="opening-logo" />
        <div className="opening-manajemen">
          <span className="opening-garis opening-garis-kiri" />
          <span className="opening-kata">MANAJEMEN</span>
          <span className="opening-garis opening-garis-kanan" />
        </div>
        <span className="opening-kilau" />
      </div>
    </div>
  );
}
