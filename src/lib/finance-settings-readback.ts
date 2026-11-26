/**
 * Read-only comparison of the finance configuration requested by Owner with
 * the newest rows retrieved after the existing save RPCs.
 *
 * This module has no Supabase client, side effects, SQL, or business-rule math.
 * For OFF/PERCENTAGE/PER_ROOM, only fields active in that mode are compared.
 */
export type RequestedFinanceSettings = {
  minimumDpMode: string;
  minimumDpValue: number;
  commissionMode: string;
  commissionRate: number;
  perRoomAmount: number;
};

export type StoredFinanceSettings = {
  minimum_dp_mode: string;
  minimum_dp_value: number;
};

export type StoredCommissionConfig = {
  mode: string;
  rate: number;
  per_room_amount: number;
};

function sameNumber(left: number, right: number): boolean {
  return Number.isFinite(Number(left)) &&
    Number.isFinite(Number(right)) &&
    Math.abs(Number(left) - Number(right)) < 0.000001;
}

export function matchesPersistedFinanceSettings(
  requested: RequestedFinanceSettings,
  storedFinance: StoredFinanceSettings | null | undefined,
  storedCommission: StoredCommissionConfig | null | undefined,
): boolean {
  if (!storedFinance || !storedCommission) return false;
  if (requested.minimumDpMode !== storedFinance.minimum_dp_mode) return false;
  if (!sameNumber(requested.minimumDpValue, storedFinance.minimum_dp_value)) return false;
  if (requested.commissionMode !== storedCommission.mode) return false;
  switch (requested.commissionMode) {
    case 'OFF':
      return true;
    case 'PERCENTAGE':
      return sameNumber(requested.commissionRate, storedCommission.rate);
    case 'PER_ROOM':
      return sameNumber(requested.perRoomAmount, storedCommission.per_room_amount);
    default:
      return false;
  }
}
