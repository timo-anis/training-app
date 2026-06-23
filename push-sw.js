/* push-sw.js — push-only handler, importScripts'd into the workbox SW.
 * Inert until a subscription exists AND the server sends a push (both require
 * VITE_VAPID_PUBLIC_KEY armed + the notify-on-message function live). No effect
 * on the trainee PWA's offline/caching behavior. See TRACK4_PUSH_RUNBOOK.md. */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_e) { /* ignore */ }
  const title = data.title || 'New message';
  const body = data.body || '';
  const url = data.url || '/';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
