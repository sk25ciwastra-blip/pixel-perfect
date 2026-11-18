type HistoryLink = {
  id: string;
  room_id: string;
  transaction_id: string | null;
  job_id: string | null;
  job_number: string | null;
  action: string;
  to_status: string;
};
type ChecklistLink = {
  housekeeping_history_id: string;
  room_id: string;
  transaction_id: string | null;
};

/** A checklist links to start_cleaning, not the later finish_cleaning row.
 * Never infer legacy links from room number, timestamp, or transaction alone.
 */
export function checklistForReadyJob<T extends ChecklistLink>(
  ready: HistoryLink | undefined,
  history: readonly HistoryLink[],
  checklists: readonly T[],
): T | undefined {
  if (!ready || ready.action !== 'finish_cleaning' || ready.to_status !== 'ready'
      || !ready.job_id || !ready.job_number) return undefined;
  const starts = history.filter(row => row.action === 'start_cleaning'
    && row.room_id === ready.room_id && row.job_id === ready.job_id
    && row.job_number === ready.job_number
    && row.transaction_id === ready.transaction_id);
  const matches = checklists.filter(row => row.room_id === ready.room_id
    && row.transaction_id === ready.transaction_id
    && starts.some(start => start.id === row.housekeeping_history_id));
  // Ambiguous legacy/corrupt relationships must not label a different job.
  return matches.length === 1 ? matches[0] : undefined;
}
