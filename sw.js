/* Service worker — la app abre sin señal, pero SIEMPRE intenta traer
   la versión más reciente cuando hay internet (network-first para el HTML).
   Solo gestiona recursos de nuestro propio dominio: todo lo externo
   (mapas, API, tiles) va directo a la red, sin cachear errores. */
const CACHE = "salud-ve-v22";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Solo recursos de nuestro propio origen. Lo externo va directo a la red.
  if (url.origin !== self.location.origin) return;

  const isDoc = e.request.mode === "navigate" ||
                e.request.destination === "document" ||
                url.pathname === "/" || url.pathname.endsWith("/index.html");

  if (isDoc) {
    // HTML: red primero (lo más nuevo), caché solo como respaldo sin señal.
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      }).catch(() => caches.match(e.request).then((h) => h || caches.match("./index.html")))
    );
    return;
  }

  // Estáticos propios: caché primero; solo se cachean respuestas correctas (nunca un error).
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      }).catch(() => hit)
    )
  );
});
