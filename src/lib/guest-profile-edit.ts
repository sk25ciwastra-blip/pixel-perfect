/**
 * Profile edits must write only fields the operator actually touched.
 *
 * A legacy guest might store phone "62..." (without '+') or mixed-case
 * address text. Opening Perbarui and changing only Email must never
 * silently reformat those unrelated fields or invent an audit event.
 */
export type GuestEditField = 'full_name' | 'address' | 'phone' | 'email';

export type GuestEditTouched = Record<GuestEditField, boolean>;

export const untouchedGuestEdit: GuestEditTouched = {
  full_name: false,
  address: false,
  phone: false,
  email: false,
};

export type GuestEditOriginal = {
  full_name: string;
  address: string;
  phone: string;
  email: string | null;
};

export type GuestEditNormalized = {
  full_name: string;
  address: string;
  phone: string;
  email: string | null;
};

/**
 * Inputs in 'next' have already passed required-field and WhatsApp/email
 * format validation. Return an exact, narrow UPDATE patch. An empty patch
 * means the operator has not made a material change.
 */
export function changedGuestProfileFields(
  before: GuestEditOriginal,
  next: GuestEditNormalized,
  touched: GuestEditTouched,
): Partial<GuestEditNormalized> {
  const patch: Partial<GuestEditNormalized> = {};
  if (touched.full_name && before.full_name !== next.full_name) patch.full_name = next.full_name;
  if (touched.address && before.address !== next.address) patch.address = next.address;
  if (touched.phone && before.phone !== next.phone) patch.phone = next.phone;
  if (touched.email && (before.email ?? null) !== next.email) patch.email = next.email;
  return patch;
}
