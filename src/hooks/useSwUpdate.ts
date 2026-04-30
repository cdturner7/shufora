import { useState, useEffect, useCallback } from 'react';

export function useSwUpdate() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const updateAvailable = waitingWorker !== null;

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    async function check() {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;

      const markWaiting = (sw: ServiceWorker) => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          setWaitingWorker(sw);
        }
      };

      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
      }

      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => markWaiting(sw));
      });
    }

    check().catch(() => {});
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return;
    waitingWorker.postMessage('SKIP_WAITING');
    window.location.reload();
  }, [waitingWorker]);

  return { updateAvailable, applyUpdate };
}
