const CACHE_NAME = "radarboard-v1";
const ASSETS_TO_CACHE = ["/", "/favicon.svg", "/manifest.json"];

// Install event: cache initial assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event: cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event: Stale-While-Revalidate for non-API calls
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip API calls (handled by SWR client-side) and chrome-extension
  if (url.pathname.startsWith("/api") || url.protocol === "chrome-extension:") {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((response) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
        return response || fetchPromise;
      });
    })
  );
});
