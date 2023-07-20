import { v5 } from 'uuid';
import { NotiflyStorage, NotiflyStorageKeys } from './Storage';
import { NAMESPACE } from './Constants';
import { logEvent } from './Event';

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
        const permission = Notification.permission;
        if (askPermission && permission === 'default') {
            const notiflyNotificationPermission = await NotiflyStorage.getItem(
                NotiflyStorageKeys.NOTIFLY_NOTIFICATION_PERMISSION
            );
            if (notiflyNotificationPermission != 'denied') {
                _showPrompt(registration, vapidPublicKey, promptDelayMillis);
                // We should early return here because the user has not yet made a decision on the prompt.
                // In this case, we should not log the subscription.
                // Subscription logging will be done when the user clicks the prompt.
                return;
            }
        }
        if (permission === 'granted') {
            const subscription = await _getSubscription(registration, vapidPublicKey);
            await _logSubscription(subscription);
        }
    }
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
    const notiflyDeviceIDLocalStore = await NotiflyStorage.getItem(NotiflyStorageKeys.NOTIFLY_DEVICE_ID);
    if (notiflyDeviceIDLocalStore) {
        notiflyDeviceID = notiflyDeviceIDLocalStore;
    } else {
        notiflyDeviceID = v5(subscriptionStr, NAMESPACE.DEVICEID).replace(/-/g, '');
        await NotiflyStorage.setItem(NotiflyStorageKeys.NOTIFLY_DEVICE_ID, notiflyDeviceID);
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

function _showPrompt(registration: ServiceWorkerRegistration, vapidPublicKey: string, promptDelayMillis = 5000) {
    let delay = promptDelayMillis;
    if (delay < 0) {
        console.warn('[Notifly] Invalid prompt delay. Defaulting to 5000 milliseconds.');
        delay = 5000;
    }

    setTimeout(() => {
        if (document.readyState === 'complete') {
            _show(registration, vapidPublicKey);
        } else {
            const task = () => {
                _show(registration, vapidPublicKey);
                window.removeEventListener('DOMContentLoaded', task);
            };
            window.addEventListener('DOMContentLoaded', task);
        }
    }, delay);
}

function _show(registration: ServiceWorkerRegistration, vapidPublicKey: string): void {
    const overlay = document.createElement('div');
    const popup = document.createElement('div');
    const closeButton = document.createElement('button');
    const header = document.createElement('h2');
    const message = document.createElement('p');
    const buttonContainer = document.createElement('div');
    const grantButton = document.createElement('button');
    const denyButton = document.createElement('button');

    overlay.id = 'overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '10px';
    overlay.style.right = '10px';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '9999';
    overlay.style.width = '350px';
    overlay.style.maxWidth = '50%';

    popup.id = 'popup';
    popup.style.position = 'relative';
    popup.style.paddingTop = '10px';
    popup.style.paddingRight = '20px';
    popup.style.paddingBottom = '20px';
    popup.style.paddingLeft = '20px';
    popup.style.backgroundColor = '#fff';
    popup.style.border = '1px solid #d3d3d3';
    popup.style.borderRadius = '8px';
    popup.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';

    closeButton.style.position = 'absolute';
    closeButton.style.right = '20px';
    closeButton.style.top = '10px';
    closeButton.style.border = 'none';
    closeButton.style.background = 'none';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '25px';
    closeButton.style.color = '#c6c6c6';
    closeButton.innerHTML = '&times;';

    header.style.marginTop = '10px';
    header.style.marginBottom = '5px';
    header.style.marginLeft = '0px';
    header.style.marginRight = '0px';
    message.style.marginTop = '5px';
    message.style.marginBottom = '10px';
    message.style.marginLeft = '0px';
    message.style.marginRight = '0px';
    header.style.fontWeight = '600';
    message.style.fontWeight = '400';

    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';

    grantButton.style.padding = '5px 15px';
    grantButton.style.border = 'none';
    grantButton.style.backgroundColor = '#007bff';
    grantButton.style.color = 'white';
    grantButton.style.cursor = 'pointer';
    grantButton.style.borderRadius = '5px';

    denyButton.style.padding = '5px 15px';
    denyButton.style.border = 'none';
    denyButton.style.backgroundColor = '#808080';
    denyButton.style.color = 'white';
    denyButton.style.cursor = 'pointer';
    denyButton.style.borderRadius = '5px';

    header.style.fontSize = '16px';
    message.style.fontSize = '16px';
    grantButton.style.fontSize = '16px';
    denyButton.style.fontSize = '16px';
    header.style.setProperty(
        'font-family',
        "'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
        'important'
    );
    message.style.setProperty(
        'font-family',
        "'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
        'important'
    );
    grantButton.style.setProperty(
        'font-family',
        "'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
        'important'
    );
    denyButton.style.setProperty(
        'font-family',
        "'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
        'important'
    );

    const language = navigator.language;
    if (language.startsWith('ko')) {
        header.textContent = '\uD83D\uDD14 푸시 알림 받기';
        message.textContent = '푸시 알림을 허용하고 중요한 정보를 실시간으로 받아보세요! ';
        grantButton.textContent = '알림 받기';
        denyButton.textContent = '다음에';
    } else {
        header.textContent = '\uD83D\uDD14 Receive Push Notifications';
        message.textContent = 'Allow push notifications and receive important information in real-time!';
        grantButton.textContent = 'Receive Notifications';
        denyButton.textContent = 'Not Now';
    }

    overlay.appendChild(popup);
    buttonContainer.appendChild(grantButton);
    buttonContainer.appendChild(denyButton);
    popup.appendChild(closeButton);
    popup.appendChild(header);
    popup.appendChild(message);
    popup.appendChild(buttonContainer);

    document.body.appendChild(overlay);

    grantButton.onclick = async () => {
        document.body.removeChild(overlay);
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.warn('[Notifly] Notification permission was not granted.');
            } else {
                const subscription = await _getSubscription(registration, vapidPublicKey);
                await _logSubscription(subscription);
            }
        } catch (e) {
            console.error('[Notifly] Failed to subscribe push notification: ', e);
        }
    };

    denyButton.onclick = async () => {
        console.warn('[Notifly] Notification permission was not granted.');
        try {
            await NotiflyStorage.setItem(NotiflyStorageKeys.NOTIFLY_NOTIFICATION_PERMISSION, 'denied');
        } catch (e) {
            console.error('[Notifly] Failed to set notification permission to denied: ', e);
        }
        document.body.removeChild(overlay);
    };

    closeButton.onclick = async () => {
        console.warn('[Notifly] Notification permission was not granted.');
        try {
            await NotiflyStorage.setItem(NotiflyStorageKeys.NOTIFLY_NOTIFICATION_PERMISSION, 'denied');
        } catch (e) {
            console.error('[Notifly] Failed to set notification permission to denied: ', e);
        }
        document.body.removeChild(overlay);
    };
}

export { _urlBase64ToUint8Array, _getSubscription, registerServiceWorker };
