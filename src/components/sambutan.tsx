import { useCallback, useEffect, useRef, useState } from 'react';
import { ambilSambutan, sapaanUntuk } from '@/lib/sambutan';
import { usePeran } from '@/lib/peran';
import gambarSambutan from '@/assets/sambutan-panel.png';
import '@/components/sambutan.css';

const TAHAN_MS = 2000;
const FADE_MS = 320;

export function Sambutan() {
  const { posisiKode } = usePeran();
  const [fase, setFase] = useState<'masuk' | 'tampil' | 'tutup' | 'selesai'>('masuk');
  const timer = useRef<ReturnType<typeof setTimeout>[]>([]);

  const tutup = useCallback(() => {
    setFase((f) => (f === 'tampil' ? 'tutup' : f));
  }, []);

  // Tunggu semua gambar termuat agar sambutan tampil utuh sebelum hitungan dimulai.
  useEffect(() => {
    let batal = false;
    const muat = (src: string) => new Promise<void>((r) => { const i = new Image(); i.onload = i.onerror = () => r(); i.src = src; });
    const cadangan = new Promise<void>((r) => setTimeout(r, 2500));
    Promise.race([Promise.all([gambarSambutan.url].map(muat)), cadangan]).then(() => {
      if (batal) return;
      const t1 = setTimeout(() => setFase('tampil'), 30);
      const t2 = setTimeout(() => setFase('tutup'), 30 + TAHAN_MS);
      timer.current = [t1, t2];
    });
    return () => { batal = true; timer.current.forEach(clearTimeout); };
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
      <img src={gambarSambutan.url} alt="" aria-hidden="true" className="sambutan-gambar" />
    </div>
  );
}

// Dipanggil dari gerbang akses: true hanya sekali tepat setelah login berhasil.
export function perluSambutan(): boolean {
  return ambilSambutan();
}
