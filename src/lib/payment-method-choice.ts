/** Selecting another payment method replaces the first when combined payments are OFF. */
export function choosePaymentMethods<T extends string>(
  current: readonly T[],
  selected: T,
  combinedPaymentEnabled: boolean,
): T[] {
  if (!combinedPaymentEnabled) return [selected];
  if (current.includes(selected)) {
    return current.length > 1 ? current.filter(method => method !== selected) : [selected];
  }
  return current.length < 2 ? [...current, selected] : [...current];
}

export function amountAfterPaymentSwitch<T extends string>(
  currentAmounts: Partial<Record<T, string>>,
  currentMethods: readonly T[],
  nextMethod: T,
  combinedPaymentEnabled: boolean,
): Partial<Record<T, string>> {
  if (combinedPaymentEnabled || currentMethods.includes(nextMethod)) return { ...currentAmounts };
  const oldMethod = currentMethods[0];
  return { [nextMethod]: oldMethod ? (currentAmounts[oldMethod] ?? '') : '' } as Partial<Record<T, string>>;
}
