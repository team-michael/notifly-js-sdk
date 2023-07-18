// NotiflyServiceWorker.ts

const NOTIFLY_SERVICE_WORKER_VERSION = 'v1.0.4';
const NOTIFLY_LOG_EVENT_URL = 'https://12lnng07q2.execute-api.ap-northeast-2.amazonaws.com/prod/records';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(swActivate());
});

self.addEventListener('push', (event) => {
    const { notifly } = event.data.json();
    if (!notifly) return;

    const options = {
        body: notifly.bd,
        icon: notifly.ic,
        badge: notifly.bg,
        image: notifly.im,
        vibrate: notifly.vb,
        sound: notifly.sd,
        tag: notifly.tg,
        renotify: notifly.rn || true,
        requireInteraction: notifly.ri,
        data: {
            ...notifly.data,
            url: notifly.u,
            campaign_id: notifly.cid,
            notifly_message_id: notifly.mid,
        },
        actions: notifly.ac,
    };

    event.waitUntil(self.registration.showNotification(notifly.ti, options));
    event.waitUntil(
        logNotiflyInternalEvent('push_delivered', {
            type: 'message_event',
            channel: 'web-push-notification',
            campaign_id: notifly.cid,
            notifly_message_id: notifly.mid,
        })
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    if (event.action === 'close') {
        return;
    }
    const messageData = event.notification?.data;
    if (!messageData) {
        return;
    }
    const { campaign_id, notifly_message_id } = messageData;
    event.waitUntil(
        logNotiflyInternalEvent('push_click', {
            type: 'message_event',
            channel: 'web-push-notification',
            campaign_id: campaign_id,
            notifly_message_id: notifly_message_id,
        })
    );

    const url = messageData.url || self.origin;
    if (!url) {
        return;
    }
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientsArr) => {
            for (const client of clientsArr) {
                if (compareUrls(url, client.url) && 'focus' in client) {
                    return client.focus();
                }
            }
            clients.openWindow(url).then((windowClient) => (windowClient ? windowClient.focus() : null));
        })
    );
});

async function swActivate() {
    try {
        await setItemToIndexedDB('notifly', '__notiflySWVersion', NOTIFLY_SERVICE_WORKER_VERSION);
    } catch (error) {
        console.warn('[Notifly] Failed to activate Service Worker: ', error);
    }
}

async function getItemFromIndexedDB(dbName, key) {
    try {
        const db = await openDB(dbName);
        const transaction = db.transaction('notiflyconfig');
        const store = transaction.objectStore('notiflyconfig');
        const value = await getValue(store, key);
        return value !== undefined ? value : null; // localForage returns null if key is not found
    } catch (error) {
        console.warn('[Notifly] Failed to get item from IndexedDB: ', error);
        return null;
    }
}

function openDB(name) {
    return new Promise((resolve, reject) => {
        const openReq = indexedDB.open(name, 2);
        openReq.onerror = () => reject(openReq.error);
        openReq.onsuccess = () => resolve(openReq.result);
        openReq.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('notiflyconfig')) {
                db.createObjectStore('notiflyconfig');
            }
        };
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
    try {
        const db = await openDB(dbName);
        const transaction = db.transaction('notiflyconfig', 'readwrite');
        const store = transaction.objectStore('notiflyconfig');
        await setValue(store, key, value);
    } catch (error) {
        console.warn('[Notifly] Failed to set item to IndexedDB: ', error);
    }
}

function setValue(store, key, value) {
    return new Promise<void>((resolve, reject) => {
        const putReq = store.put(value, key);
        putReq.onerror = () => reject(putReq.error);
        putReq.onsuccess = () => resolve();
    });
}

async function getCognitoIdTokenInSw(): Promise<string | null> {
    const [userName, password] = [
        await getItemFromIndexedDB('notifly', '__notiflyUserName'),
        await getItemFromIndexedDB('notifly', '__notiflyPassword'),
    ];
    if (!userName || !password) {
        return null;
    }

    try {
        const response = await fetch('https://api.notifly.tech/authorize', {
            method: 'POST',
            body: JSON.stringify({
                userName,
                password,
            }),
        });
        const result = await response.text();
        const token = JSON.parse(result).AuthenticationResult.IdToken;
        return token;
    } catch (error) {
        console.warn('[Notifly]: ', error);
        return '';
    }
}

async function saveCognitoIdTokenInSW(cognitoIdToken): Promise<void> {
    setItemToIndexedDB('notifly', '__notiflyCognitoIDToken', cognitoIdToken);
}

async function logNotiflyInternalEvent(eventName, eventParams = null, segmentationEventParamKeys = null) {
    try {
        const [cognitoToken, notiflyUserID, externalUserID, projectID, notiflyDeviceID] = await Promise.all([
            getItemFromIndexedDB('notifly', '__notiflyCognitoIDToken'),
            getItemFromIndexedDB('notifly', '__notiflyUserID'),
            getItemFromIndexedDB('notifly', '__notiflyExternalUserID'),
            getItemFromIndexedDB('notifly', '__notiflyProjectID'),
            getItemFromIndexedDB('notifly', '__notiflyDeviceID'),
        ]);
        if (!(cognitoToken && notiflyUserID && externalUserID && projectID && notiflyDeviceID)) {
            console.warn('[Notifly]: Fail to trackEvent because of invalid LocalForage setup.');
            return;
        }
        const body = _getBodyForLogEvent(
            eventName,
            eventParams,
            segmentationEventParamKeys,
            projectID,
            notiflyUserID,
            externalUserID,
            notiflyDeviceID,
            true
        );
        const requestOptions = _getRequestOptionsForLogEvent(cognitoToken, body);
        const response = await request(NOTIFLY_LOG_EVENT_URL, requestOptions);

        // If the token is expired, get a new token and retry the logEvent.
        if (response.message == 'The incoming token has expired') {
            const newCognitoToken = await getCognitoIdTokenInSw();
            await Promise.all([retryLogEvent(newCognitoToken, body), saveCognitoIdTokenInSW(newCognitoToken)]);
        }
    } catch (err) {
        console.warn('[Notifly] Failed logging the event. Please retry the initialization. ', err);
    }
}

async function retryLogEvent(token, body) {
    const requestOptions = _getRequestOptionsForLogEvent(token, body);
    return await request(NOTIFLY_LOG_EVENT_URL, requestOptions);
}

function _getBodyForLogEvent(
    eventName,
    eventParams,
    segmentationEventParamKeys,
    projectID,
    notiflyUserID,
    externalUserID,
    notiflyDeviceID,
    isInternalEvent
) {
    const eventData = JSON.stringify({
        id: generateRandomString(16),
        name: eventName,
        event_params: eventParams,
        segmentation_event_param_keys: segmentationEventParamKeys,
        project_id: projectID,
        notifly_user_id: notiflyUserID,
        external_user_id: externalUserID,
        notifly_device_id: notiflyDeviceID,
        is_internal_event: isInternalEvent,
        time: Math.floor(new Date().valueOf() / 1000),
    });

    const body = JSON.stringify({
        'records': [
            {
                'data': eventData,
                'partitionKey': notiflyUserID,
            },
        ],
    });
    return body;
}

function _getRequestOptionsForLogEvent(token, body) {
    const myHeaders = new Headers();
    myHeaders.append('Authorization', token);
    myHeaders.append('Content-Type', 'application/json');

    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: body,
        redirect: 'follow',
    };
    return requestOptions;
}

async function request(apiUrl, requestOptions) {
    const result = fetch(apiUrl, requestOptions).then((response) => response.json());
    return result;
}

function generateRandomString(size) {
    const epoch = Math.floor(size / 10) + (size % 10 > 0 ? 1 : 0);
    let randomString = '';
    for (let i = 0; i < epoch; i++) {
        randomString += Math.random().toString(36).substring(2, 12);
    }
    return randomString.substring(0, size);
}

function compareUrls(url1, url2) {
    const parsedUrl1 = new URL(url1);
    const parsedUrl2 = new URL(url2);
    if (
        parsedUrl1.href === parsedUrl2.href &&
        parsedUrl1.protocol === parsedUrl2.protocol &&
        parsedUrl1.host === parsedUrl2.host &&
        parsedUrl1.pathname === parsedUrl2.pathname &&
        parsedUrl1.search === parsedUrl2.search &&
        parsedUrl1.hash === parsedUrl2.hash
    ) {
        return true;
    } else {
        return false;
    }
}
