// Service worker do caderno (gerado no build a partir de integrations/sw-modelo.js).
// Páginas: rede primeiro, cache se offline. Arquivos /_astro: cache primeiro. /api: sempre rede.
const VERSAO = '__VERSAO__';
const PAGINAS = __PAGINAS__;
const ESTATICOS = __ESTATICOS__;
const CACHE = 'caderno-' + VERSAO;

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      const todos = [...ESTATICOS, ...PAGINAS];
      for (let i = 0; i < todos.length; i += 8) {
        await Promise.all(
          todos.slice(i, i + 8).map(async (url) => {
            try {
              const r = await fetch(url, { credentials: 'same-origin', cache: 'no-cache' });
              if (r.ok && !r.redirected) await c.put(url, r);
            } catch (e) {}
          }),
        );
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith('caderno-') && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

function chavePagina(url) {
  let p = url.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  return p === '' || p === '/index' ? '/' : p;
}

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    ev.respondWith(
      (async () => {
        const chave = chavePagina(url);
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 5000);
          const r = await fetch(req, { signal: ctrl.signal });
          clearTimeout(t);
          if (r.ok && !r.redirected && PAGINAS.includes(chave)) {
            const c = await caches.open(CACHE);
            c.put(chave, r.clone());
          }
          return r;
        } catch (e) {
          const c = await caches.open(CACHE);
          return (await c.match(chave)) || (await c.match('/')) || new Response('Offline e página não guardada.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
        }
      })(),
    );
    return;
  }

  ev.respondWith(
    (async () => {
      const c = await caches.open(CACHE);
      const guardado = await c.match(url.pathname);
      if (guardado && url.pathname.startsWith('/_astro/')) return guardado;
      const rede = fetch(req)
        .then((r) => {
          if (r.ok && !r.redirected) c.put(url.pathname, r.clone());
          return r;
        })
        .catch(() => guardado || Response.error());
      return guardado || rede;
    })(),
  );
});
