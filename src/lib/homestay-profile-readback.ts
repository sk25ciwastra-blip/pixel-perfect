/**
 * Verify that the profile returned by the existing read RPC has all four values
 * just submitted by Owner. A successful HTTP/RPC response by itself does not
 * prove that the latest persisted profile matches the requested values.
 *
 * Pure, read-only utility. No database access, writes, or contact details in logs.
 */
export type HomestayProfileValues = {
  business_name: string;
  address: string;
  phone: string;
  whatsapp: string;
};

export function matchesHomestayProfileReadback(
  requested: HomestayProfileValues,
  stored: Partial<HomestayProfileValues> | null | undefined,
): boolean {
  if (!stored) return false;
  return (
    stored.business_name === requested.business_name &&
    stored.address === requested.address &&
    stored.phone === requested.phone &&
    stored.whatsapp === requested.whatsapp
  );
}
