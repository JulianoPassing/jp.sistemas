const CACHE_NAME = 'jp-cobrancas-v1';
const urlsToCache = [
  './',
  './dashboard.html',
  './clientes.html',
  './cobrancas.html',
  './atrasados.html',
  './lista-negra.html',
  './emprestimos.html',
  './historico.html',
  './configuracoes.html',
  './adicionar-cliente.html',
  './login.html',
  './css/style.css',
  './js/main.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseClone)).catch(() => {});
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(e.request);
        if (cachedResponse) return cachedResponse;
        if (e.request.mode === 'navigate') return caches.match('./login.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});
