/** UI-only monthly turnover targets — no bonus payout and no Cloud writes.
 *  This keeps the existing browser-local persistence behaviour.
 */
export const KUNCI_TARGET_LEGACY = "baturaden25.target_omzet_bulanan";
export const KUNCI_TARGET_TAHAPAN = "baturaden25.target_omzet_bulanan_tahapan";

export type TargetOmzetTahapan = { standard: number; bonus: number };
export type TargetOmzetBacaan = TargetOmzetTahapan & { legacy: boolean };
export type PenyimpananTarget = Pick<Storage, "getItem">;
export type ZonaOmzet = "belum_diatur" | "merah" | "hijau" | "biru";

const rupiahBulatPositif = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n > 0;

export function validasiTargetOmzet(standard: number, bonus: number): string | null {
  if (!rupiahBulatPositif(standard) || !rupiahBulatPositif(bonus)) {
    return "Isi Standard Operasional dan Target Bonus dengan nominal rupiah bulat lebih dari Rp0.";
  }
  if (bonus <= standard) {
    return "Target Bonus harus lebih besar daripada Standard Operasional.";
  }
  return null;
}

/** Read-only legacy migration; an old single target is NOT considered approved bonus.
 *  Its value may prefill the new modal but levels remain unconfigured until saved.
 */
export function bacaTargetOmzet(storage: PenyimpananTarget): TargetOmzetBacaan {
  try {
    const saved = storage.getItem(KUNCI_TARGET_TAHAPAN);
    if (saved !== null) {
      const parsed: unknown = JSON.parse(saved);
      if (parsed !== null && typeof parsed === "object"
        && "standard" in parsed && "bonus" in parsed) {
        const standard = (parsed as { standard: unknown }).standard;
        const bonus = (parsed as { bonus: unknown }).bonus;
        if (typeof standard === "number" && typeof bonus === "number"
          && validasiTargetOmzet(standard, bonus) === null) {
          return { standard, bonus, legacy: false };
        }
      }
      // Invalid new settings must not be silently treated as a valid saved target.
      return { standard: 0, bonus: 0, legacy: false };
    }
    const oldValue = Number(storage.getItem(KUNCI_TARGET_LEGACY) ?? 0);
    if (rupiahBulatPositif(oldValue)) {
      return { standard: 0, bonus: oldValue, legacy: true };
    }
  } catch {
    // Local storage may be unavailable/blocked. No fake success is shown.
  }
  return { standard: 0, bonus: 0, legacy: false };
}

export function zonaTargetOmzet(realisasi: number, standard: number, bonus: number): ZonaOmzet {
  if (validasiTargetOmzet(standard, bonus) !== null) return "belum_diatur";
  const total = Number.isFinite(realisasi) ? Math.max(0, realisasi) : 0;
  if (total >= bonus) return "biru";
  if (total >= standard) return "hijau";
  return "merah";
}

export function progresOmzetBonus(realisasi: number, standard: number, bonus: number): number {
  if (validasiTargetOmzet(standard, bonus) !== null || !Number.isFinite(realisasi)) return 0;
  return Math.min(100, Math.max(0, (realisasi / bonus) * 100));
}
