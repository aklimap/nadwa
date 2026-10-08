/* Nadwa — service worker : notifications push et page hors connexion. */
'use strict';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Pages : réseau d'abord ; sans connexion, un message simple au lieu de la page d'erreur du navigateur.
const HORS_LIGNE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nadwa</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111A33;color:#fff;font-family:system-ui,"Segoe UI",Arial,sans-serif;text-align:center;padding:24px}b{color:#F2A93B;font-size:28px}</style></head>
<body><div><b>Nadwa</b><p>Pas de connexion Internet. · No internet connection. · لا يوجد اتصال بالإنترنت.</p><p><button onclick="location.reload()">↻</button></p></div></body></html>`;

self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(HORS_LIGNE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { titre: 'Nadwa', texte: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titre || 'Nadwa', {
    body: d.texte || '',
    icon: '/icones/icone-192.png',
    badge: '/icones/badge-96.png',
    tag: d.tag || undefined,
    renotify: Boolean(d.tag),
    data: { url: d.url || '/' },
  }));
});

// Clic sur la notification : on ouvre (ou on reprend) Nadwa à la bonne page.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const nadwa = fenetres.find((c) => new URL(c.url).origin === self.location.origin);
    if (nadwa) {
      await nadwa.focus();
      nadwa.postMessage({ type: 'nadwa:ouvrir', url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
