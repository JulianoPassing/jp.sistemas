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
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))));
  self.clients.claim();
});
