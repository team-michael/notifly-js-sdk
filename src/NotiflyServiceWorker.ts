/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference no-default-lib="true"/>
/// <reference lib="es2015" />
/// <reference lib="webworker" />

const NOTIFLY_SERVICE_WORKER_VERSION = 'v1.3.0';
const NOTIFLY_SERVICE_WORKER_SEMVER = NOTIFLY_SERVICE_WORKER_VERSION.replace('v', '');
const NOTIFLY_LOG_EVENT_URL = 'https://12lnng07q2.execute-api.ap-northeast-2.amazonaws.com/prod/records';
const NOTIFLY_OBJECT_STORE_NAME = 'notiflyconfig';

const sw: ServiceWorkerGlobalScope & typeof globalThis = self as any;

sw.addEventListener('install', () => {
    sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
    event.waitUntil(swActivate());
});

sw.addEventListener('push', (event) => {
    if (!event.data) return;
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

    event.waitUntil(sw.registration.showNotification(notifly.ti, options));
    event.waitUntil(
        logNotiflyInternalEvent('push_delivered', {
            type: 'message_event',
            channel: 'web-push-notification',
            campaign_id: notifly.cid,
            notifly_message_id: notifly.mid,
        })
    );
});

sw.addEventListener('notificationclick', function (event) {
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
    event.waitUntil(action(messageData.url || null));
});

async function action(url: string | null) {
    // 1. If URL is specified, compare with current hostname.
    // 1-1. If URL is same with current hostname, focus the window if it exists. Otherwise open a new window.
    // 1-2. If URL is different with current hostname, open a new window.
    // 2. If URL is not specified, open a new window with current hostname if the window does not exist.
    // Otherwise focus the existing window.

    const swHostname = sw.location.hostname;
    const urlHostname = url ? new URL(url).hostname : null;
    const clientsList = await sw.clients.matchAll({ type: 'window' });
    const existingClient = clientsList.find((client) => new URL(client.url).hostname === (urlHostname || swHostname));

    if (url && urlHostname) {
        if (swHostname === urlHostname) {
            if (existingClient) {
                if (!existingClient.focused) {
                    await existingClient.focus();
                }
                existingClient.postMessage({
                    action: '__notifly_navigate_to_url',
                    url: url,
                });
            } else {
                await sw.clients.openWindow(url);
            }
        } else {
            await sw.clients.openWindow(url);
        }
    } else {
        if (existingClient) {
            if (!existingClient.focused) {
                await existingClient.focus();
            }
        } else {
            await sw.clients.openWindow(sw.origin);
        }
    }
}

async function swActivate() {
    try {
        await setItemToIndexedDB('notifly', '__notiflySWVersion', NOTIFLY_SERVICE_WORKER_VERSION);
    } catch (error) {
        console.warn('[Notifly Service Worker] Failed to activate Service Worker: ', error);
    }
}

async function getItemFromIndexedDB(dbName: string, key: IDBValidKey) {
    try {
        const db = await openDB(dbName);
        const transaction = db.transaction(NOTIFLY_OBJECT_STORE_NAME);
        const store = transaction.objectStore(NOTIFLY_OBJECT_STORE_NAME);
        const value = await getValue(store, key);
        return value !== undefined ? value : null; // localForage returns null if key is not found
    } catch (error) {
        console.warn('[Notifly Service Worker] Failed to get item from IndexedDB: ', error);
        return null;
    }
}

function openDB(name: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const openReq = indexedDB.open(name);
        openReq.onerror = () => reject(openReq.error);
        openReq.onsuccess = () => resolve(openReq.result);
        openReq.onupgradeneeded = (event) => {
            if (!event.target) return;
            const request: IDBOpenDBRequest = event.target as IDBOpenDBRequest;
            const db = request.result;
            if (!db.objectStoreNames.contains(NOTIFLY_OBJECT_STORE_NAME)) {
                db.createObjectStore(NOTIFLY_OBJECT_STORE_NAME);
            }
        };
    });
}

function getValue(store: IDBObjectStore, key: IDBValidKey): Promise<any> {
    return new Promise((resolve, reject) => {
        const getReq = store.get(key);
        getReq.onerror = () => reject(getReq.error);
        getReq.onsuccess = () => resolve(getReq.result);
    });
}

async function setItemToIndexedDB(dbName: string, key: IDBValidKey, value: any) {
    try {
        const db = await openDB(dbName);
        const transaction = db.transaction(NOTIFLY_OBJECT_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(NOTIFLY_OBJECT_STORE_NAME);
        await setValue(store, key, value);
    } catch (error) {
        console.warn('[Notifly Service Worker] Failed to set item to IndexedDB: ', error);
    }
}

function setValue(store: IDBObjectStore, key: IDBValidKey, value: any) {
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
            headers: {
                'X-Notifly-SDK-Version': `notifly/js-sw/${NOTIFLY_SERVICE_WORKER_SEMVER}`,
            },
        });
        const result = await response.json();
        return result.AuthenticationResult?.IdToken || null;
    } catch (error) {
        console.warn('[Notifly Service Worker]: Failed to get authentication token ', error);
        return null;
    }
}

async function saveCognitoIdTokenInSW(cognitoIdToken: string): Promise<void> {
    await setItemToIndexedDB('notifly', '__notiflyCognitoIDToken', cognitoIdToken);
}

async function logNotiflyInternalEvent(
    eventName: string,
    eventParams: Record<string, any> | null = null,
    segmentationEventParamKeys: Array<string> | null = null
) {
    try {
        const [cognitoToken, notiflyUserID, externalUserID, projectID, notiflyDeviceID] = await Promise.all([
            getItemFromIndexedDB('notifly', '__notiflyCognitoIDToken'),
            getItemFromIndexedDB('notifly', '__notiflyUserID'),
            getItemFromIndexedDB('notifly', '__notiflyExternalUserID'),
            getItemFromIndexedDB('notifly', '__notiflyProjectID'),
            getItemFromIndexedDB('notifly', '__notiflyDeviceID'),
        ]);
        if (!(notiflyUserID && projectID && notiflyDeviceID)) {
            console.warn('[Notifly Service Worker]: Fail to trackEvent because of invalid LocalForage setup.');
            return;
        }

        let token: string | null = cognitoToken;
        if (!token) {
            token = await getCognitoIdTokenInSw();
            if (!token) {
                console.warn('[Notifly Service Worker]: Fail to trackEvent');
                return;
            }
            await saveCognitoIdTokenInSW(token);
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
        const requestOptions = _getRequestOptionsForLogEvent(token, body);
        const response = await fetch(NOTIFLY_LOG_EVENT_URL, requestOptions);

        // If the token is expired, get a new token and retry the logEvent.
        if (response.status === 401) {
            token = await getCognitoIdTokenInSw();
            if (!token) {
                console.warn('[Notifly Service Worker] Failed to get authentication token.');
                return;
            }
            await Promise.all([retryLogEvent(token, body), saveCognitoIdTokenInSW(token)]);
        }
    } catch (err) {
        console.warn('[Notifly Service Worker] Failed logging the event. ', err);
    }
}

async function retryLogEvent(token: string, body: string) {
    const requestOptions = _getRequestOptionsForLogEvent(token, body);
    const response = await fetch(NOTIFLY_LOG_EVENT_URL, requestOptions);
    if (!response.ok) {
        throw new Error('Retry failed.');
    }
}

const _getTimestampMicroseconds = (): number => {
    if (window.performance && 'now' in window.performance && 'timeOrigin' in window.performance) {
        return Math.floor((window.performance.now() + window.performance.timeOrigin) * 1000);
    }
    return Date.now() * 1000;
};

function _getBodyForLogEvent(
    eventName: string,
    eventParams: Record<string, any> | null,
    segmentationEventParamKeys: Array<string> | null,
    projectID: string,
    notiflyUserID: string,
    externalUserID: string,
    notiflyDeviceID: string,
    isInternalEvent: boolean
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
        time: _getTimestampMicroseconds(),
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

function _getRequestOptionsForLogEvent(token: string, body: string) {
    const headers = new Headers();
    headers.append('Authorization', token);
    headers.append('Content-Type', 'application/json');
    headers.append('X-Notifly-SDK-Version', `notifly/js-sw/${NOTIFLY_SERVICE_WORKER_SEMVER}`);

    const requestOptions: RequestInit = {
        method: 'POST',
        headers: headers,
        body: body,
        redirect: 'follow',
        keepalive: true,
    };
    return requestOptions;
}

function generateRandomString(size: number) {
    const epoch = Math.floor(size / 10) + (size % 10 > 0 ? 1 : 0);
    let randomString = '';
    for (let i = 0; i < epoch; i++) {
        randomString += Math.random().toString(36).substring(2, 12);
    }
    return randomString.substring(0, size);
}
