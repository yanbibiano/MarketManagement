/* ═══════════════════════════════════════════
   SERVICE WORKER — GestãoLoja PWA
   Estratégia: Cache-first para assets estáticos.
   Os dados ficam no localStorage (não no cache).
═══════════════════════════════════════════ */

const CACHE_NAME = 'gestao-loja-v7';

// Arquivos que serão cacheados para uso offline
// (Os dados em si vêm da API/backend, não são cacheados aqui.)
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/api.js',
  './js/vendas.js',
  './js/scanner.js',
  './manifest.json'
];

/* ── INSTALL: cacheia os assets na primeira vez ── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  // Ativa imediatamente sem esperar abas antigas fecharem
  self.skipWaiting();
});

/* ── ACTIVATE: limpa caches antigos ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(key) { return key !== CACHE_NAME; })
          .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

/* ── FETCH: cache-first para assets locais, network para CDN ── */
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Deixa passar requests externos (Google Fonts, cdnjs, etc.)
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        return cached;
      }
      // Se não está no cache, busca na rede e guarda
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        var toCache = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, toCache);
        });
        return response;
      });
    })
  );
});
