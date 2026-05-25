self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: 'New notification',
      body: event.data ? event.data.text() : '',
    };
  }

  const title = payload.title || 'Store notification';
  const options = {
    body: payload.body || 'Open your admin panel for details.',
    icon: payload.icon || '/favicon.ico',
    badge: payload.badge || '/favicon.ico',
    tag: payload.tag || payload.eventId || 'store-notification',
    data: {
      url: payload.url || '/admin/orders',
      eventId: payload.eventId || null,
    },
    requireInteraction: Boolean(payload.requireInteraction),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || '/admin/orders', self.location.origin).href;

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const sameOriginClient = clientList.find((client) => client.url.startsWith(self.location.origin));

    if (sameOriginClient) {
      await sameOriginClient.focus();
      return sameOriginClient.navigate(targetUrl);
    }

    return clients.openWindow(targetUrl);
  })());
});
