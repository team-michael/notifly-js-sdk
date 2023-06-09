// NotiflyServiceWorker.js

// Version of service worker
const NOTIFLY_SERVICE_WORKER_VERSION = 'v0.10';

// Installing service worker
self.addEventListener('install', () => {
    console.log(`Notifly SDK Worker ${NOTIFLY_SERVICE_WORKER_VERSION} is installed!`);
});

// Activating service worker
self.addEventListener('activate', (event) => {
    event.waitUntil(swActivate());
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

async function swActivate() {
    console.log(`Notifly SDK Worker ${NOTIFLY_SERVICE_WORKER_VERSION} is activated!`);

    const token = await getItemFromIndexedDB('localforage', '__notiflyCognitoIDToken');
    console.log('__notiflyCognitoIDToken:', token);
    // set current timestamp to indexeddb
    await setItemToIndexedDB('localforage', '__notiflySWActivatedTimestamp', Date.now().toString());
    const timestamp = await getItemFromIndexedDB('localforage', '__notiflySWActivatedTimestamp');
    console.log('__notiflySWActivatedTimestamp:', timestamp);
}

async function getItemFromIndexedDB(dbName, key) {
    const db = await openDB(dbName);
    const transaction = db.transaction('keyvaluepairs');
    const store = transaction.objectStore('keyvaluepairs');
    const value = await getValue(store, key);
    return value;
}

function openDB(name) {
    return new Promise((resolve, reject) => {
        const openReq = indexedDB.open(name);
        openReq.onerror = () => reject(openReq.error);
        openReq.onsuccess = () => resolve(openReq.result);
    });
}

function getValue(store, key) {
    return new Promise((resolve, reject) => {
        const getReq = store.get(key);
        getReq.onerror = () => reject(getReq.error);
        getReq.onsuccess = () => resolve(getReq.result);
    });
}

async function setItemToIndexedDB(dbName, key, value) {
    const db = await openDB(dbName);
    const transaction = db.transaction('keyvaluepairs', 'readwrite');
    const store = transaction.objectStore('keyvaluepairs');
    await setValue(store, key, value);
}

function setValue(store, key, value) {
    return new Promise<void>((resolve, reject) => {
        const putReq = store.put(value, key);
        putReq.onerror = () => reject(putReq.error);
        putReq.onsuccess = () => resolve();
    });
}
