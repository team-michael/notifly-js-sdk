import { v5 } from 'uuid';
import localForage from './localforage';
import { NAMESPACE } from './constants';
import { logEvent } from './logEvent';
import { showPopup } from './popup/popup';

async function registerServiceWorker(
    vapidPublicKey: string,
    askPermission = true,
    path = '/notifly-service-worker.js',
    promptDelayMillis = 5000
): Promise<void> {
    if (
        typeof navigator === 'undefined' ||
        typeof navigator.serviceWorker === 'undefined' ||
        typeof navigator.serviceWorker.register === 'undefined'
    ) {
        console.warn('[Notifly] Not running in a client-side environment. Aborting service worker registration.');
        return;
    }
    const registration = await navigator.serviceWorker.register(path);
    if (typeof Notification !== 'undefined') {
        let permission = Notification.permission;
        if (askPermission && permission === 'default') {
            const notiflyNotificationPermission = await localForage.getItem('__notiflyNotificationPermission');
            if (notiflyNotificationPermission != 'denied') {
                permission = await showPopup(promptDelayMillis);
            }
        }
        if (permission !== 'granted') {
            console.warn('[Notifly] Notification permission has not been granted to the current domain.');
            return;
        }
    }
    const subscription = await _getSubscription(registration, vapidPublicKey);
    await _logSubscription(subscription);
}

function _urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function _getSubscription(
    registration: ServiceWorkerRegistration,
    VAPID_PUBLIC_KEY: string
): Promise<PushSubscription> {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
        return subscription;
    }

    const convertedVapidKey = _urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
    });
}

async function _logSubscription(subscription: PushSubscription): Promise<void> {
    const subscriptionStr = JSON.stringify(subscription);

    let notiflyDeviceID;
    const notiflyDeviceIDLocalStore = await localForage.getItem('__notiflyDeviceID');
    if (notiflyDeviceIDLocalStore) {
        notiflyDeviceID = notiflyDeviceIDLocalStore;
    } else {
        notiflyDeviceID = v5(subscriptionStr, NAMESPACE.DEVICEID).replace(/-/g, '');
        await localForage.setItem('__notiflyDeviceID', notiflyDeviceID);
    }

    return await logEvent(
        'set_device_properties',
        {
            device_token: subscriptionStr, // Use deviceToken to store the subscription
        },
        null,
        true
    );
}

export { _urlBase64ToUint8Array, _getSubscription, registerServiceWorker };
