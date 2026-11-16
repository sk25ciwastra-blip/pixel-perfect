/** Shared preview/creation format; existing identifiers are not renamed. */
export function nextEmployeeId(ids: readonly string[]): string {
  const last = ids.reduce((max, id) => {
    const match = /^BTRDEMP-(\d{4,})$/.exec(id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `BTRDEMP-${String(last + 1).padStart(4, '0')}`;
}