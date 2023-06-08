// NotiflyServiceWorker.js

// Version of service worker
const NOTIFLY_SERVICE_WORKER_VERSION = 'v0.4';

// Installing service worker
self.addEventListener('install', () => {
    console.log(`Notifly SDK Worker ${NOTIFLY_SERVICE_WORKER_VERSION} is installed!`);
});

// Activating service worker
self.addEventListener('activate', () => {
    console.log(`Notifly SDK Worker ${NOTIFLY_SERVICE_WORKER_VERSION} is activated!`);
});

// Handling push event
self.addEventListener('push', (event) => {
    const payload = event.data.json();
    console.log(`Notifly SW version: ${NOTIFLY_SERVICE_WORKER_VERSION}`);
    console.log('New notification', payload);

    const options = {
        body: payload.body,
        icon: payload.icon,
        badge: payload.badge,
        image: payload.image,
        vibrate: payload.vibrate,
        sound: payload.sound,
        tag: payload.tag,
        requireInteraction: payload.requireInteraction,
        data: payload.data,
        actions: payload.actions,
    };

    event.waitUntil(
        self.registration.showNotification(
            payload.title,
            options
        )
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    if (event.action === 'close') {
        return;
    }

    const url = event.notification.data?.url;
    if (!url) {
        return;
    }
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then(function (windowClients) {
            for (const client of windowClients) {
                // If there is at least one client, focus it.
                // TODO: test with a sub-page
                if (client.url === url && 'focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(url);
            }
        })
    );
});
