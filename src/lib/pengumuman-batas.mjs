// Batas teks pengumuman agar selalu tampil utuh di panel Papan Informasi.
export const MAKS_HURUF = 140;

// Baris baru digabung jadi spasi supaya jumlah huruf selalu menentukan jumlah baris.
export function rapikanTeks(teks) {
  return teks.replace(/\s*\n\s*/g, ' ');
}

export function bolehDisimpan(teks) {
  const bersih = rapikanTeks(teks).trim();
  return bersih.length > 0 && bersih.length <= MAKS_HURUF;
}
