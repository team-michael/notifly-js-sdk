
async function registerServiceWorker(
    vapid_public_key: string,
    path = '/test-NotiflySDKWorker.js',
): Promise<void> {
    // TODO: update the service worker file name
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
    console.log(JSON.stringify({ subscription: subscription }));
    // TODO: Send the subscription details to the server.
    // Example:
    /* 
    await fetch('./register', {
      method: 'post',
      headers: {
        'Content-type': 'application/json'
      },
      body: JSON.stringify({ subscription }),
    });
    */
}

export {
    _urlBase64ToUint8Array,
    _getSubscription,
    registerServiceWorker,
};
