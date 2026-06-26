/* Service worker — la app abre sin señal, pero SIEMPRE intenta traer
   la versión más reciente cuando hay internet (network-first para el HTML).
   Así cualquier actualización llega de inmediato a todos los usuarios. */
const CACHE = "salud-ve-v11";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
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
  // Nunca interceptar datos en vivo (Supabase, funciones, analíticas): siempre red.
  if (url.pathname.indexOf("/rest/v1/") !== -1 ||
      url.pathname.indexOf("/functions/v1/") !== -1 ||
      url.pathname.indexOf("/_vercel/") !== -1) return;
  if (e.request.method !== "GET") return;

  const isDoc = e.request.mode === "navigate" ||
                e.request.destination === "document" ||
                url.pathname === "/" || url.pathname.endsWith("/index.html");

  if (isDoc) {
    // HTML: red primero (lo más nuevo), caché como respaldo sin señal.
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request).then((h) => h || caches.match("./index.html")))
    );
    return;
  }

  // Estáticos (íconos, manifest): caché primero, con respaldo a red.
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => hit)
    )
  );
});
