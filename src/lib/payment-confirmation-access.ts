/** UI hint only. The transaction-scoped RPC is always the final authority. */
export function canUseConfirmationPdf(ready: boolean, signedIn: boolean, position: string | null, trainingStatus: string) {
  return ready && signedIn && ['owner', 'supervisor', 'receptionist'].includes(position ?? '') &&
    ['NONE', 'PASSED'].includes(trainingStatus);
}
