import {
    Language,
    TextContent,
    type ButtonDesignParams,
    type RequestPermissionPromptDesignParams,
    type TextDesignParams,
} from './Interfaces/RequestPermissionPromptDesignParams';
import { NotiflyStorage, NotiflyStorageKeys } from './Storage';
import { EventLogger } from './Event';

enum NotiflyServiceWorkerEvents {
    NAVIGATE_TO_URL = '__notifly_navigate_to_url',
}

const REQUEST_PERMISSION_PROMPT_ID_PREFIX = '__notifly_push_prompt_';

const DEFAULT_DESIGN_PARAMS = {
    backgroundColor: '#ffffff',
    borderColor: '#d3d3d3',
    headerDesign: {
        color: '#1f2937',
        text: {
            ko: '푸시 알림 받기',
            en: 'Receive Push Notifications',
            ja: 'プッシュ通知を受け取る',
            zh: '接收推送通知',
        },
    },
    messageDesign: {
        color: '#374151',
        text: {
            ko: '푸시 알림을 허용하고 중요한 정보를 실시간으로 받아보세요! ',
            en: 'Allow push notifications and receive important information in real-time!',
            ja: 'プッシュ通知を許可し、リアルタイムで重要な情報を受け取りましょう！',
            zh: '允许推送通知并实时接收重要信息！',
        },
    },
    grantButtonDesign: {
        backgroundColor: '#2563eb',
        backgroundHoverColor: '#1d4ed8',
        color: '#ffffff',
        text: {
            ko: '알림 받기',
            en: 'Receive Notifications',
            ja: '通知を受け取る',
            zh: '接收通知',
        },
    },
    denyButtonDesign: {
        backgroundColor: '#27272a',
        backgroundHoverColor: '#334155',
        color: '#ffffff',
        text: {
            ko: '다음에',
            en: 'Not Now',
            ja: '今は結構です',
            zh: '暂不',
        },
    },
    bellIconColor: '#eab308',
    closeButtonColor: '#c6c6c6',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export class NotiflyWebPushManager {
    private static _isInitialized = false;
    private static _isRequestPermissionPromptBeingShown = false;

    // fixme: null or values not 'denied' means not set (either default or granted), 'denied' means denied.
    private static _notiflyNotificationPermission: string | null = null;

    private static _serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
    private static _vapidPublicKey: string | null = null;
    private static _askPermission = true;
    private static _promptDelayMillis = 5000;
    private static _promptDefaultLanguage: Language = Language.EN;
    private static _promptDesignParams?: RequestPermissionPromptDesignParams;

    static async initialize(
        vapidPublicKey: string,
        askPermission = true,
        path = '/notifly-service-worker.js',
        promptDelayMillis = 5000,
        promptDefaultLanguage: Language = Language.EN,
        promptDesignParams?: RequestPermissionPromptDesignParams
    ) {
        try {
            if (this._isInitialized || !this._isWebPushSupported()) {
                return;
            }

            const registration = await navigator.serviceWorker.register(path);
            if ('pushManager' in registration === false) {
                console.warn('[Notifly] Push notification is not supported in this browser.');
                return;
            }

            this._serviceWorkerRegistration = registration;
            this._vapidPublicKey = vapidPublicKey;
            this._askPermission = askPermission;

            if (promptDelayMillis < 0) {
                console.warn('[Notifly] Invalid prompt delay. Defaulting to 5000 milliseconds.');
            } else {
                this._promptDelayMillis = promptDelayMillis;
            }
            if (Object.values(Language).indexOf(promptDefaultLanguage) < 0) {
                console.warn('[Notifly] Invalid default language. Defaulting to English.');
            } else {
                this._promptDefaultLanguage = promptDefaultLanguage;
            }
            this._promptDesignParams = promptDesignParams;

            this._notiflyNotificationPermission = await NotiflyStorage.getItem(
                NotiflyStorageKeys.NOTIFLY_NOTIFICATION_PERMISSION
            );

            this._setupServiceWorkerEventListener();

            await this._maybeLogSubscription();
            this._maybeScheduleRequestPermissionPrompt();

            this._isInitialized = true;
        } catch (error) {
            console.error('[Notifly] Failed to initialize PushManager: ', error);
        }
    }

    static requestPermission(languageToForce?: Language) {
        if (!this._isInitialized) {
            console.error('[Notifly] PushManager is not initialized.');
            return;
        }
        if (!this._canManuallyShowPermissionRequestPrompt()) {
            return;
        }

        this._showRequestPermissionPrompt(languageToForce);
    }

    private static _isWebPushSupported(): boolean {
        if (typeof Notification === 'undefined') {
            console.warn('[Notifly] Notification is not supported in this browser.');
            return false;
        }
        if (typeof navigator === 'undefined' || 'serviceWorker' in navigator === false) {
            console.warn('[Notifly] Service worker is not supported in this browser.');
            return false;
        }
        if (typeof navigator.serviceWorker.register !== 'function') {
            console.warn('[Notifly] Service worker registration is not supported in this browser.');
            return false;
        }

        return true;
    }

    private static _setupServiceWorkerEventListener() {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data.action === NotiflyServiceWorkerEvents.NAVIGATE_TO_URL && event.data.url) {
                window.location.href = event.data.url;
            }
        });
    }

    private static async _maybeLogSubscription() {
        if (Notification.permission === 'granted') {
            const subscription = await this._getSubscription();
            await this._logSubscription(subscription);
        }
    }

    private static _canAutomaticallyShowPermissionRequestPrompt() {
        return (
            this._askPermission &&
            Notification.permission === 'default' &&
            this._notiflyNotificationPermission !== 'denied'
        );
    }

    private static _canManuallyShowPermissionRequestPrompt() {
        if (this._askPermission) {
            console.warn("[Notifly] Can't manually show permission request prompt when askPermission is true.");
            return false;
        }
        return Notification.permission === 'default' && this._notiflyNotificationPermission !== 'denied';
    }

    private static async _getSubscription(): Promise<PushSubscription> {
        if (!this._serviceWorkerRegistration || this._vapidPublicKey == null) {
            throw new Error('[Notifly] _getSubscription() was called before initialization.');
        }

        const registration = this._serviceWorkerRegistration;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            return subscription;
        }

        const convertedVapidKey = this._urlBase64ToUint8Array(this._vapidPublicKey);
        return registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey,
        });
    }

    private static async _logSubscription(subscription: PushSubscription): Promise<void> {
        return await EventLogger.logEvent(
            'set_device_properties',
            {
                device_token: JSON.stringify(subscription), // Use deviceToken to store the subscription
            },
            null,
            true
        );
    }

    static _urlBase64ToUint8Array(base64String: string): Uint8Array {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    private static _maybeScheduleRequestPermissionPrompt() {
        if (!this._canAutomaticallyShowPermissionRequestPrompt()) {
            return;
        }

        const delay = this._promptDelayMillis;
        setTimeout(() => {
            if (document.readyState === 'loading') {
                const task = () => {
                    this._showRequestPermissionPrompt();
                    window.removeEventListener('DOMContentLoaded', task);
                };
                window.addEventListener('DOMContentLoaded', task);
            } else {
                this._showRequestPermissionPrompt();
            }
        }, delay);
    }

    private static _generateElementId(postfix: string) {
        return `${REQUEST_PERMISSION_PROMPT_ID_PREFIX}${postfix}`;
    }

    private static _createOverlay(): HTMLDivElement {
        const overlay = document.createElement('div');
        overlay.id = this._generateElementId('overlay');
        overlay.style.position = 'fixed';
        overlay.style.top = '10px';
        overlay.style.right = '10px';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '9999';
        overlay.style.width = '350px';
        overlay.style.maxWidth = '50%';
        return overlay;
    }

    private static _createPopup(backgroundColor?: string, borderColor?: string) {
        const popup = document.createElement('div');
        popup.id = this._generateElementId('popup');
        popup.style.position = 'relative';
        popup.style.paddingTop = '10px';
        popup.style.paddingRight = '18px';
        popup.style.paddingBottom = '18px';
        popup.style.paddingLeft = '20px';
        popup.style.backgroundColor = backgroundColor || DEFAULT_DESIGN_PARAMS.backgroundColor;
        popup.style.border = `1px solid ${borderColor || DEFAULT_DESIGN_PARAMS.borderColor}`;
        popup.style.borderRadius = '8px';
        popup.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
        return popup;
    }

    private static _createBellIcon(color?: string) {
        const bellIcon = document.createElementNS(SVG_NS, 'svg');
        const bellIconClassName = '--notifly-bell-icon';
        const keyframes = document.createElement('style');
        const keyframesName = '--notifly-bell-icon-animation';

        keyframes.innerHTML = `
        @keyframes ${keyframesName} {
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

        bellIcon.setAttribute('xmlns', SVG_NS);
        bellIcon.setAttribute('viewBox', '0 0 48 48');
        bellIcon.style.width = '21px';
        bellIcon.style.height = '21px';
        bellIcon.innerHTML = `
        <defs>
          <style>.${bellIconClassName}{fill:${color || DEFAULT_DESIGN_PARAMS.bellIconColor};}</style>
        </defs>
        <path class="${bellIconClassName}" d="M24,44a6,6,0,0,0,5.67-4H18.33A6,6,0,0,0,24,44Z"/>
        <path class="${bellIconClassName}" d="M39.38,35.26,38,31.81V22A14,14,0,0,0,26.71,8.27a3,3,0,1,0-5.42,0A14,14,0,0,0,10,22v9.81L8.62,35.26A2,2,0,0,0,10.48,38h27a2,2,0,0,0,1.86-2.74Z"/>
          `;
        bellIcon.style.animation = `${keyframesName} 0.6s ease-in-out infinite`;
        bellIcon.style.transformOrigin = 'top center';
        return {
            bellIcon,
            keyframes,
        };
    }

    private static _createCloseButton(color?: string) {
        const closeButton = document.createElementNS(SVG_NS, 'svg');
        closeButton.style.position = 'absolute';
        closeButton.style.right = '8px';
        closeButton.style.top = '8px';
        closeButton.style.cursor = 'pointer';
        closeButton.setAttribute('xmlns', SVG_NS);
        closeButton.setAttribute('viewBox', '0 0 24 24');
        closeButton.style.width = '18px';
        closeButton.style.height = '18px';
        closeButton.innerHTML = `
        <path d="M17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289C19.0976 5.68342 19.0976 6.31658 18.7071 6.70711L13.4142 12L18.7071 17.2929C19.0976 17.6834 19.0976 18.3166 18.7071 18.7071C18.3166 19.0976 17.6834 19.0976 17.2929 18.7071L12 13.4142L6.70711 18.7071C6.31658 19.0976 5.68342 19.0976 5.29289 18.7071C4.90237 18.3166 4.90237 17.6834 5.29289 17.2929L10.5858 12L5.29289 6.70711C4.90237 6.31658 4.90237 5.68342 5.29289 5.29289C5.68342 4.90237 6.31658 4.90237 6.70711 5.29289L12 10.5858L17.2929 5.29289Z" fill="${color}"/>
        `;
        return closeButton;
    }

    private static _createButton({
        params,
        languageToForce,
        defaultParams,
    }: {
        params?: ButtonDesignParams;
        languageToForce?: Language;
        defaultParams: {
            backgroundColor: string;
            backgroundHoverColor: string;
            color: string;
            text: {
                ko: string;
                en: string;
            };
        };
    }) {
        const button = document.createElement('button');
        button.style.padding = '5px 15px';
        button.style.margin = '0px';
        button.style.border = 'none';
        button.style.backgroundColor = params?.backgroundColor || defaultParams.backgroundColor;
        button.style.color = params?.color || defaultParams.color;
        button.style.fontWeight = '500';
        button.style.cursor = 'pointer';
        button.style.borderRadius = '5px';
        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = params?.backgroundHoverColor || defaultParams.backgroundHoverColor;
        });
        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = params?.backgroundColor || defaultParams.backgroundColor;
        });
        button.style.fontSize = '13.5px';
        button.style.letterSpacing = '-0.3px';
        button.textContent = this._optTextByPreferredLanguage({
            textContent: params?.text,
            languageToForce,
            defaultTextContent: defaultParams.text,
        });
        return button;
    }

    private static _createHeader({
        params,
        languageToForce,
        defaultParams,
    }: {
        params?: TextDesignParams;
        languageToForce?: Language;
        defaultParams: typeof DEFAULT_DESIGN_PARAMS.messageDesign;
    }) {
        const header = document.createElement('h2');
        header.style.fontSize = '17px';
        header.style.color = params?.color || defaultParams.color;
        header.style.letterSpacing = '-0.5px';
        header.style.fontWeight = '800';
        header.style.marginLeft = '6px';
        header.style.marginTop = '0px';
        header.style.marginBottom = '0px';
        header.textContent = this._optTextByPreferredLanguage({
            textContent: params?.text,
            languageToForce: languageToForce,
            defaultTextContent: defaultParams.text,
        });
        return header;
    }

    private static _createMessage({
        params,
        languageToForce,
        defaultParams,
    }: {
        params?: TextDesignParams;
        languageToForce?: Language;
        defaultParams: typeof DEFAULT_DESIGN_PARAMS.messageDesign;
    }) {
        const message = document.createElement('p');
        message.style.padding = '0px';
        message.style.marginTop = '8px';
        message.style.marginBottom = '16px';
        message.style.marginLeft = '0px';
        message.style.marginRight = '0px';
        message.style.fontSize = '15px';
        message.style.fontWeight = '400';
        message.style.color = params?.color || defaultParams.color;
        message.style.lineHeight = '1.3';
        message.style.letterSpacing = '-0.3px';
        message.textContent = this._optTextByPreferredLanguage({
            textContent: params?.text,
            languageToForce,
            defaultTextContent: defaultParams.text,
        });
        return message;
    }

    private static _showRequestPermissionPrompt(languageToForce?: Language): void {
        if (!this._isInitialized || this._isRequestPermissionPromptBeingShown) {
            return;
        }
        this._isRequestPermissionPromptBeingShown = true;

        const overlay = this._createOverlay();
        const popup = this._createPopup(
            this._promptDesignParams?.backgroundColor,
            this._promptDesignParams?.borderColor
        );

        const headerContainer = document.createElement('div');
        headerContainer.style.display = 'flex';
        headerContainer.style.justifyContent = 'start';
        headerContainer.style.alignItems = 'center';
        headerContainer.style.marginTop = '10px';
        headerContainer.style.marginBottom = '5px';
        headerContainer.style.marginLeft = '0px';
        headerContainer.style.marginRight = '0px';

        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.gap = '6px';

        const { bellIcon, keyframes } = this._createBellIcon(this._promptDesignParams?.bellIconColor);
        const closeButton = this._createCloseButton(this._promptDesignParams?.closeButtonColor);

        const header = this._createHeader({
            params: this._promptDesignParams?.headerDesign,
            languageToForce,
            defaultParams: DEFAULT_DESIGN_PARAMS.headerDesign,
        });
        const message = this._createMessage({
            params: this._promptDesignParams?.messageDesign,
            languageToForce,
            defaultParams: DEFAULT_DESIGN_PARAMS.messageDesign,
        });

        // Buttons
        const grantButton = this._createButton({
            params: this._promptDesignParams?.grantButtonDesign,
            languageToForce,
            defaultParams: DEFAULT_DESIGN_PARAMS.grantButtonDesign,
        });
        const denyButton = this._createButton({
            params: this._promptDesignParams?.denyButtonDesign,
            languageToForce,
            defaultParams: DEFAULT_DESIGN_PARAMS.denyButtonDesign,
        });

        // Buttons event listeners
        const cleanup = () => {
            this._isRequestPermissionPromptBeingShown = true;
            document.body.removeChild(overlay);
            try {
                document.head.removeChild(keyframes);
            } catch (e) {
                // ignore
            }
        };
        const onDenied = () => {
            console.info('[Notifly] Notification permission was not granted.');
            NotiflyStorage.setItem(NotiflyStorageKeys.NOTIFLY_NOTIFICATION_PERMISSION, 'denied')
                .catch((e) => console.error('[Notifly] Failed to set notification permission to denied: ', e))
                .finally(cleanup);
        };
        const onGranted = () => {
            cleanup();
            Notification.requestPermission().then((permission) => {
                if (permission !== 'granted') {
                    console.info('[Notifly] Notification permission was not granted.');
                } else {
                    this._getSubscription()
                        .then((subscription) => this._logSubscription(subscription))
                        .catch((e) => console.error('[Notifly] Failed to subscribe push notification: ', e));
                }
            });
        };

        grantButton.onclick = onGranted.bind(this);
        denyButton.onclick = onDenied;
        closeButton.onclick = onDenied;

        [header, message, grantButton, denyButton].forEach((element) => {
            element.style.setProperty(
                'font-family',
                "'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
                'important'
            );
        });

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
    }

    private static _optTextByPreferredLanguage({
        textContent,
        languageToForce,
        defaultTextContent,
    }: {
        textContent?: TextContent;
        languageToForce?: Language;
        defaultTextContent: TextContent;
    }): string {
        if (languageToForce) {
            return textContent?.[languageToForce] || defaultTextContent[languageToForce]!;
        }

        const language = navigator?.language || null;
        const defaultContent =
            textContent?.[this._promptDefaultLanguage] || defaultTextContent[this._promptDefaultLanguage]!;
        if (!language) {
            return defaultContent;
        }
        for (const lang of Object.values(Language)) {
            if (language.startsWith(lang)) {
                return textContent?.[lang] || defaultTextContent[lang]!;
            }
        }

        return defaultContent;
    }
}
