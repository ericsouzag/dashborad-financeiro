// Service worker mínimo: guarda o shell do app para abrir offline.
const CACHE = "painel-financeiro-v1";
const ASSETS = [
  "./", "./index.html", "./css/style.css",
  "./js/app.js", "./js/auth.js", "./js/data.js",
  "./js/dashboard.js", "./js/pdf-parser.js",
  "./js/categorize-rules.js", "./js/firebase-config.js",
  "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Firebase e CDNs sempre pela rede.
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
