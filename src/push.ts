import { v5 } from 'uuid';
import { NAMESPACE } from './constants';
import { logEvent } from './logEvent';

async function registerServiceWorker(
    vapid_public_key: string,
    path = '/notifly-service-worker.js',
): Promise<void> {
    const registration = await navigator.serviceWorker.register(path);
    // We ask the end users to grant permission for notifications, when permission status is default.
    // When permission status is denied, we don't ask again.
    // When permission status is granted, we don't ask.
    // We might want to change the behavior when the permission status is default.
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        console.warn('[Notifly] Permission not granted for Notification');
        return;
    }
    const subscription = await _getSubscription(registration, vapid_public_key);
    await _logSubscription(subscription);
}

function _urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}


async function _getSubscription(registration: ServiceWorkerRegistration, VAPID_PUBLIC_KEY: string): Promise<PushSubscription> {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
        return subscription;
    }

    // Chrome doesn't accept the base64-encoded (string) vapidPublicKey yet
    const convertedVapidKey = _urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
    });
}

async function _logSubscription(subscription: PushSubscription): Promise<void> {
    const subscriptionStr = JSON.stringify(subscription);
    console.log(`subscription: ${subscriptionStr}`);

    let notiflyDeviceID;
    const notiflyDeviceIDLocalStorage = localStorage.getItem('__notiflyDeviceID');
    if (notiflyDeviceIDLocalStorage) {
        notiflyDeviceID = notiflyDeviceIDLocalStorage;
    } else {
        notiflyDeviceID = v5(subscriptionStr, NAMESPACE.DEVICEID).replace(/-/g, '');
        localStorage.setItem('__notiflyDeviceID', notiflyDeviceID);
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

export {
    _urlBase64ToUint8Array,
    _getSubscription,
    registerServiceWorker,
};
