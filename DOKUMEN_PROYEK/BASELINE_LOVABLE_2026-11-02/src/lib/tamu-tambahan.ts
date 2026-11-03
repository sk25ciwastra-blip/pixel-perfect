/** Aturan Owner: tamu lebih dari 2 orang dikenai Rp50.000 per orang tambahan. */
export const TAMU_TERMASUK = 2;
export const TARIF_TAMU_TAMBAHAN = 50_000;

export function biayaTamuTambahan(jumlahTamu: number) {
  const tambahan = Math.max(0, Math.floor(jumlahTamu) - TAMU_TERMASUK);
  return { tambahan, tarif: TARIF_TAMU_TAMBAHAN, total: tambahan * TARIF_TAMU_TAMBAHAN };
}