// NotiflySDKWorker.js

// Version of service worker
const version = 'v0.0';

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
    const data = event.data.json(); // assumes you're getting a JSON payload
    console.log('New notification', data);

    // Options for the notification
    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        image: data.image,
        vibrate: data.vibrate,
        sound: data.sound,
        data: data.link,
        actions: [
            { action: 'confirm', title: 'Confirm' },
            { action: 'cancel', title: 'Cancel' },
        ]
    };

    // Waiting until the notification is shown
    event.waitUntil(self.registration.showNotification(data.title, options));
});
