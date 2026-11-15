import type { PosisiAkses } from '@/lib/peran';

// Penanda satu kali per login; disetel hanya setelah signInWithPassword berhasil.
const KUNCI = 'b25-sambutan';

export function tandaiSambutan() {
  try {
    sessionStorage.setItem(KUNCI, '1');
  } catch {
    /* penyimpanan sesi tidak tersedia */
  }
}

// true hanya sekali: penanda langsung dihapus agar refresh/pindah halaman tidak menampilkan ulang.
export function ambilSambutan(): boolean {
  try {
    if (sessionStorage.getItem(KUNCI) !== '1') return false;
    sessionStorage.removeItem(KUNCI);
    // Muat ulang dengan sesi aktif tidak boleh menampilkan sambutan.
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === 'reload') return false;
    return true;
  } catch {
    return false;
  }
}

type Sapaan = { judul: string; pesan: string; label: string };

const SAPAAN: Record<Exclude<PosisiAkses, null>, Sapaan> = {
  owner: {
    judul: 'Selamat Datang Kembali!',
    pesan: 'Saatnya memantau operasional Baturaden 25 Homestay.',
    label: 'OWNER',
  },
  supervisor: {
    judul: 'Selamat Bertugas!',
    pesan: 'Mari pastikan pelayanan hari ini berjalan lancar.',
    label: 'SUPERVISOR',
  },
  receptionist: {
    judul: 'Selamat Bertugas!',
    pesan: 'Sambutan hangat menciptakan pengalaman berkesan.',
    label: 'RECEPTIONIST',
  },
  housekeeping: {
    judul: 'Selamat Bertugas!',
    pesan: 'Kamar bersih, tamu nyaman, pelayanan semakin baik.',
    label: 'HOUSEKEEPING',
  },
  inspector: {
    judul: 'Selamat Bertugas!',
    pesan: 'Setiap detail menentukan kualitas pelayanan.',
    label: 'INSPECTOR',
  },
  investor: {
    judul: 'Selamat Datang Kembali!',
    pesan: 'Pantau perkembangan Baturaden 25 Homestay.',
    label: 'INVESTOR',
  },
};

export function sapaanUntuk(posisiKode: PosisiAkses): Sapaan {
  if (posisiKode && SAPAAN[posisiKode]) return SAPAAN[posisiKode];
  return {
    judul: 'Selamat Datang!',
    pesan: 'Selamat bekerja di Baturaden 25 Homestay.',
    label: 'MANAJEMEN',
  };
}
