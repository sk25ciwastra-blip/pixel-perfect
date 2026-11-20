/** Official IDs for new Baturaden 25 Homestay employees.
 * Old BTRDEMP/KR/QA numbers remain historical and are never renumbered.
 * Real issuance MUST use the PostgreSQL forward-only allocator, not this preview.
 */
export function nextEmployeeId(ids: readonly string[]): string {
  const used = ids.reduce((max, id) => {
    const match = /^B25EMP-(\d{3,})$/.exec(id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `B25EMP-${String(used + 1).padStart(3, '0')}`;
}
