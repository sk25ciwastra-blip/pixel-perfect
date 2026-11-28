/** Installs only a network-first navigation offline-notice worker.
 * Never caches sensitive application responses or enables offline mutations.
 */
export function registerOfflineSafePwa(): void {
  if (typeof window === "undefined" || !window.isSecureContext) return;
  if (!("serviceWorker" in navigator)) return;

  void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
    // If SW registration is unavailable, the app continues fully online.
  });
}
