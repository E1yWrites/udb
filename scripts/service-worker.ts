// The service worker's source (ADR 9), written out by the build with the list
// of files in dist/ and a cache name that changes with every commit.
//
// - Install: precache every build file, so the app opens offline after one visit.
// - Navigation: network first, so a reload picks up a new deploy; the cached
//   page only answers when the network doesn't.
// - Other same-origin GETs: cache first (build files are content-hashed).
// - Cross-origin requests and non-GETs are never touched.
// - No skipWaiting: a new worker takes over when the old one's tabs are closed,
//   never while a session may be writing to a device.

export function serviceWorkerSource(version: string, files: string[]): string {
  return `// UDB service worker, generated at build time. See docs/adr/0009-pwa-offline.md.
const CACHE = ${JSON.stringify(`udb-${version}`)};
const FILES = ${JSON.stringify(files)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('udb-') && k !== CACHE).map((k) => caches.delete(k)))),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(
        (response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        },
        () => caches.match('./index.html'),
      ),
    );
    return;
  }
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
        }),
    ),
  );
});
`;
}
