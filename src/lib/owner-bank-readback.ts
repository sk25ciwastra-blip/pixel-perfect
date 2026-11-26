/**
 * Read-only verification of the persisted Owner bank account after an existing
 * upsert RPC. The RPC returns its UUID; verifying by UUID avoids ambiguous
 * matches when two accounts share bank, name, or account number.
 *
 * Pure helper: no Supabase, no writes, and no account data in logs.
 */
export type OwnerBankReadback = {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  logo_key: string;
  active: boolean;
};

export function matchesOwnerBankReadback(
  expected: OwnerBankReadback,
  stored: Partial<OwnerBankReadback> | null | undefined,
): boolean {
  if (!stored || !expected.id || stored.id !== expected.id) return false;
  return (
    stored.bank_name === expected.bank_name &&
    stored.account_name === expected.account_name &&
    stored.account_number === expected.account_number &&
    stored.logo_key === expected.logo_key &&
    stored.active === expected.active
  );
}
