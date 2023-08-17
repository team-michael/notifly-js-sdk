import { v5 } from 'uuid';
import { NotiflyStorage, NotiflyStorageKeys } from './Storage';
import { NAMESPACE } from './Constants';
import { EventManager } from './Event/Manager';

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

    return await EventManager.logEvent(
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
    const svgNS = 'http://www.w3.org/2000/svg';

    const overlay = document.createElement('div');
    const popup = document.createElement('div');
    const bellIcon = document.createElementNS(svgNS, 'svg');
    const keyframes = document.createElement('style');
    const closeButton = document.createElementNS(svgNS, 'svg');
    const headerContainer = document.createElement('div');
    const header = document.createElement('h2');
    const message = document.createElement('p');
    const buttonContainer = document.createElement('div');
    const grantButton = document.createElement('button');
    const denyButton = document.createElement('button');

    overlay.id = '--notifly-push-prompt-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '10px';
    overlay.style.right = '10px';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '9999';
    overlay.style.width = '350px';
    overlay.style.maxWidth = '50%';

    popup.id = '--notifly-push-prompt-body';
    popup.style.position = 'relative';
    popup.style.paddingTop = '10px';
    popup.style.paddingRight = '18px';
    popup.style.paddingBottom = '18px';
    popup.style.paddingLeft = '20px';
    popup.style.backgroundColor = '#fff';
    popup.style.border = '1px solid #d3d3d3';
    popup.style.borderRadius = '8px';
    popup.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';

    bellIcon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    bellIcon.setAttribute('viewBox', '0 0 48 48');
    bellIcon.style.width = '21px';
    bellIcon.style.height = '21px';
    bellIcon.innerHTML = `
    <defs>
      <style>.--notifly-bell-icon{fill:#eab308;}</style>
    </defs>
    <path class="--notifly-bell-icon" d="M24,44a6,6,0,0,0,5.67-4H18.33A6,6,0,0,0,24,44Z"/>
    <path class="--notifly-bell-icon" d="M39.38,35.26,38,31.81V22A14,14,0,0,0,26.71,8.27a3,3,0,1,0-5.42,0A14,14,0,0,0,10,22v9.81L8.62,35.26A2,2,0,0,0,10.48,38h27a2,2,0,0,0,1.86-2.74Z"/>
  	`;
    bellIcon.style.animation = '--notifly-bell-icon-animation 0.6s ease-in-out infinite';
    bellIcon.style.transformOrigin = 'top center';

    keyframes.innerHTML = `
	@keyframes --notifly-bell-icon-animation {
		0% { transform: rotateZ(0deg); }
		12.5% { transform: rotateZ(-5deg); }
        25% { transform: rotateZ(-7deg); }
		37.5% { transform: rotateZ(-5deg); }
        50% { transform: rotateZ(0deg); }
		62.5% { transform: rotateZ(5deg); }
        75% { transform: rotateZ(7deg); }
		87.5% { transform: rotateZ(5deg); }
        100% { transform: rotateZ(0deg); }
	}
	`;
    document.head.appendChild(keyframes);

    closeButton.style.position = 'absolute';
    closeButton.style.right = '8px';
    closeButton.style.top = '8px';
    closeButton.style.cursor = 'pointer';
    closeButton.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    closeButton.setAttribute('viewBox', '0 0 24 24');
    closeButton.style.width = '18px';
    closeButton.style.height = '18px';
    closeButton.innerHTML = `
	<path d="M17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289C19.0976 5.68342 19.0976 6.31658 18.7071 6.70711L13.4142 12L18.7071 17.2929C19.0976 17.6834 19.0976 18.3166 18.7071 18.7071C18.3166 19.0976 17.6834 19.0976 17.2929 18.7071L12 13.4142L6.70711 18.7071C6.31658 19.0976 5.68342 19.0976 5.29289 18.7071C4.90237 18.3166 4.90237 17.6834 5.29289 17.2929L10.5858 12L5.29289 6.70711C4.90237 6.31658 4.90237 5.68342 5.29289 5.29289C5.68342 4.90237 6.31658 4.90237 6.70711 5.29289L12 10.5858L17.2929 5.29289Z" fill="#c6c6c6"/>
	`;

    headerContainer.style.display = 'flex';
    headerContainer.style.justifyContent = 'start';
    headerContainer.style.alignItems = 'center';
    headerContainer.style.marginBottom = '5px';
    headerContainer.style.marginLeft = '0px';
    headerContainer.style.marginRight = '0px';

    header.style.fontWeight = '600';
    header.style.marginLeft = '6px';
    message.style.marginTop = '8px';
    message.style.marginBottom = '16px';
    message.style.marginLeft = '0px';
    message.style.marginRight = '0px';

    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '6px';

    grantButton.style.padding = '5px 15px';
    grantButton.style.border = 'none';
    grantButton.style.backgroundColor = '#2563eb';
    grantButton.style.color = 'white';
    grantButton.style.fontWeight = '500';
    grantButton.style.cursor = 'pointer';
    grantButton.style.borderRadius = '5px';
    grantButton.addEventListener('mouseover', () => {
        grantButton.style.backgroundColor = '#1d4ed8';
    });
    grantButton.addEventListener('mouseout', () => {
        grantButton.style.backgroundColor = '#2563eb';
    });

    denyButton.style.padding = '5px 15px';
    denyButton.style.border = 'none';
    denyButton.style.backgroundColor = '#27272a';
    denyButton.style.color = 'white';
    denyButton.style.cursor = 'pointer';
    denyButton.style.fontWeight = '500';
    denyButton.style.borderRadius = '5px';
    denyButton.addEventListener('mouseover', () => {
        denyButton.style.backgroundColor = '#334155';
    });
    denyButton.addEventListener('mouseout', () => {
        denyButton.style.backgroundColor = '#27272a';
    });

    header.style.fontSize = '17px';
    header.style.color = '#1f2937';
    header.style.letterSpacing = '-0.5px';
    header.style.fontWeight = '800';
    message.style.fontSize = '15px';
    message.style.fontWeight = '400';
    message.style.color = '#374151';
    message.style.lineHeight = '1.3';
    message.style.letterSpacing = '-0.3px';
    grantButton.style.fontSize = '13.5px';
    grantButton.style.letterSpacing = '-0.3px';
    denyButton.style.fontSize = '13.5px';
    denyButton.style.letterSpacing = '-0.3px';
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

    const language = navigator?.language || null;
    if (!language || language.startsWith('ko')) {
        header.textContent = '푸시 알림 받기';
        message.textContent = '푸시 알림을 허용하고 중요한 정보를 실시간으로 받아보세요! ';
        grantButton.textContent = '알림 받기';
        denyButton.textContent = '다음에';
    } else {
        header.textContent = 'Receive Push Notifications';
        message.textContent = 'Allow push notifications and receive important information in real-time!';
        grantButton.textContent = 'Receive Notifications';
        denyButton.textContent = 'Not Now';
    }

    overlay.appendChild(popup);
    headerContainer.appendChild(bellIcon);
    headerContainer.appendChild(header);
    popup.appendChild(headerContainer);
    popup.appendChild(message);
    buttonContainer.appendChild(grantButton);
    buttonContainer.appendChild(denyButton);
    popup.appendChild(closeButton);
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
