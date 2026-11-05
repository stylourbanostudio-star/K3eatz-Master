// K-3EATZ MASTER PRO - Audio Mastering Service Worker
// Version 1.2.0 - Offline Caching, Background Keep-Alive, and Resilient DSP Shell

const CACHE_NAME = 'mastercore-v1.2.0';
const OFFLINE_FALLBACK_URL = '/';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png'
];

// 1. Install Event - Cache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Precaching core mastering application shell');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Some assets failed to precache (non-fatal):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event - Clean up stale caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[ServiceWorker] Purging legacy cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event - Stale-While-Revalidate for assets, Network-First for API with offline fallback
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (e.g. POST API requests)
  if (request.method !== 'GET') {
    // For API calls when offline, provide a graceful mock fallback instead of hard network failure
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(
        fetch(request).catch(() => {
          return new Response(
            JSON.stringify({
              success: true,
              offline: true,
              message: 'Operating in Offline Local DSP Mode. Cloud AI suggestions disabled until connection restores.'
            }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 200
            }
          );
        })
      );
    }
    return;
  }

  // Navigation requests (HTML page): Network first, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache fresh copy
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match('/index.html') || await cache.match('/');
          return cached || new Response('Offline: K-3EATZ MASTER PRO is active in offline mode.', {
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // Static assets (JS, CSS, images, fonts, sounds)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update for stale-while-revalidate
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {
          // Offline, ignore fetch failure
        });
        return cachedResponse;
      }

      // Not in cache: fetch and store
      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback for images
          if (request.destination === 'image') {
            return caches.match('/logo.svg');
          }
          return new Response('Resource unavailable offline', { status: 503 });
        });
    })
  );
});

// 4. Background Processing & Client Communication Message Handler
// Allows the mastering engine to keep communication alive and synchronize
// long-running offline rendering or buffer processing across tabs/backgrounding
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'KEEP_ALIVE':
      // Reply to client to confirm Service Worker is alive in background
      if (event.source) {
        event.source.postMessage({
          type: 'KEEP_ALIVE_ACK',
          timestamp: Date.now(),
          workerActive: true
        });
      }
      break;

    case 'MASTERING_TASK_START':
      console.log(`[ServiceWorker] Background DSP task started: ${data.taskId || 'render'}`);
      // Broadcast to other clients that mastering is actively running
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          if (client.id !== event.source?.id) {
            client.postMessage({
              type: 'MASTERING_STATUS_SYNC',
              status: 'processing',
              taskId: data.taskId,
              trackName: data.trackName,
              timestamp: Date.now()
            });
          }
        });
      });
      break;

    case 'MASTERING_TASK_PROGRESS':
      // Broadcast progress
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          if (client.id !== event.source?.id) {
            client.postMessage({
              type: 'MASTERING_PROGRESS_SYNC',
              taskId: data.taskId,
              progress: data.progress,
              stage: data.stage
            });
          }
        });
      });
      break;

    case 'MASTERING_TASK_COMPLETE':
      console.log(`[ServiceWorker] Background DSP task finished: ${data.taskId || 'render'}`);
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'MASTERING_STATUS_SYNC',
            status: 'completed',
            taskId: data.taskId,
            timestamp: Date.now()
          });
        });
      });
      break;

    default:
      break;
  }
});
