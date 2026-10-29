/* Society MS service worker.
 *
 * Deliberately small and private:
 *  - Pages (which hold people's dues, complaints and so on) are NEVER cached. A navigation goes to the
 *    network; if there is no connection the person sees /offline.html instead.
 *  - Only static, non-personal files are cached: the offline page, icons and the hashed files under
 *    /_next/static (they never change for a given URL).
 *  - API routes, uploads, documents and anything else are not touched at all.
 * Bump CACHE when this file's behaviour changes so old caches are removed.
 */
const CACHE = "ms-static-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192x192.png", "/icons/icon-512x512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // other hosts (file storage, fonts) are not ours to cache

  // A page load: network only, with the offline page as the safety net
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Static files: cache first, fill the cache on a miss
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
