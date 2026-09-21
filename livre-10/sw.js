// Retire the previous route on the next navigation. Do not navigate open tabs,
// erase saved comparisons or delete caches while someone may be using v1.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate' && event.request.method === 'GET'
      && url.origin === self.location.origin
      && (url.pathname === '/livre-10/' || url.pathname === '/livre-10/index.html')) {
    event.respondWith(Promise.resolve(Response.redirect('https://donizetiferr.github.io/answer-lens/', 302)));
  }
});
