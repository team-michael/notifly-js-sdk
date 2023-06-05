// NotiflySDKWorker.js

// Version of service worker
const version = 'v0.1';

// Installing service worker
self.addEventListener('install', (event) => {
    console.log(`Notifly SDK Worker ${version} is installed!`);
});

// Activating service worker
self.addEventListener('activate', (event) => {
    console.log(`Notifly SDK Worker ${version} is activated!`);
});

// Handling push event
self.addEventListener('push', (event) => {
    const payload = event.data.json();
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

    var url = event.notification.data.url;
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then(function (windowClients) {
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
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
