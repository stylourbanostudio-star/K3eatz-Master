/**
 * K-3EATZ MASTER PRO - Service Worker Registration & Lifecycle Controller
 */

export interface ServiceWorkerStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isActive: boolean;
  registration: ServiceWorkerRegistration | null;
}

let swStatus: ServiceWorkerStatus = {
  isSupported: false,
  isRegistered: false,
  isActive: false,
  registration: null
};

type StatusCallback = (status: ServiceWorkerStatus) => void;
const listeners = new Set<StatusCallback>();

function emitStatus() {
  listeners.forEach((cb) => cb(swStatus));
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    swStatus.isSupported = false;
    emitStatus();
    return Promise.resolve(null);
  }

  swStatus.isSupported = true;

  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then((registration) => {
      swStatus.isRegistered = true;
      swStatus.registration = registration;
      swStatus.isActive = !!registration.active;
      console.log('[ServiceWorker] Successfully registered with scope:', registration.scope);

      // Check if update found
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('[ServiceWorker] New content available; please refresh.');
              } else {
                console.log('[ServiceWorker] Content cached for offline use.');
              }
              swStatus.isActive = true;
              emitStatus();
            }
          };
        }
      };

      if (registration.active) {
        swStatus.isActive = true;
      }

      emitStatus();
      return registration;
    })
    .catch((error) => {
      console.warn('[ServiceWorker] Registration notice (non-fatal):', error);
      emitStatus();
      return null;
    });
}

export function onServiceWorkerStatusChange(callback: StatusCallback): () => void {
  listeners.add(callback);
  callback(swStatus);
  return () => listeners.delete(callback);
}

/**
 * Sends keep-alive ping to service worker to ensure background sync continuity
 */
export function sendServiceWorkerKeepAlive(): void {
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'KEEP_ALIVE',
      timestamp: Date.now()
    });
  }
}
