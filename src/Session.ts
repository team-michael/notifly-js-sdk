import type { NotiflyPushSubscriptionOptions } from './Types';

import { LAST_SESSION_TIME_LOGGING_INTERVAL } from './Constants';

import { NotiflyStorage, NotiflyStorageKeys } from './Storage';

import { registerServiceWorker } from './Push';
import { EventManager } from './Event/Manager';
import { WebMessageManager } from './WebMessages/Manager';

export class SessionManager {
    private static _lastSessionTime: number | null = null;
    private static _sessionDuration: number = 30 * 60;
    private static _pushSubscriptionOptions: NotiflyPushSubscriptionOptions | undefined;
    private static _storageSaverIntervalId: ReturnType<typeof setInterval> | null = null;

    static async initialize(pushSubscriptionOptions?: NotiflyPushSubscriptionOptions, sessionDuration?: number) {
        const parsedLastSessionTime = parseInt(
            (await NotiflyStorage.getItem(NotiflyStorageKeys.LAST_SESSION_TIME)) ?? '0',
            10
        );

        if (!parsedLastSessionTime || isNaN(parsedLastSessionTime)) {
            this._lastSessionTime = null;
        } else {
            this._lastSessionTime = parsedLastSessionTime;
        }

        if (sessionDuration) {
            if (sessionDuration < 5 * 60) {
                console.warn('[Notifly] Session duration must be at least 5 minutes. Defaulting to 30 minutes.');
            } else {
                this._sessionDuration = sessionDuration;
            }
        }

        if (pushSubscriptionOptions) {
            this._pushSubscriptionOptions = pushSubscriptionOptions;
        }

        await WebMessageManager.initialize(this._isSessionExpired());
        await this._maybeStartSession();
        await this._initializeInternal();
    }

    static onWindowFocus() {
        if (this._storageSaverIntervalId) {
            // This might not happen, but just in case
            clearInterval(this._storageSaverIntervalId);
        }

        this._maybeRefreshSession().then(() => {
            this._storageSaverIntervalId = setInterval(
                this.saveLastSessionTime.bind(this),
                LAST_SESSION_TIME_LOGGING_INTERVAL
            );
        });
    }

    static onWindowBlur() {
        if (this._storageSaverIntervalId) {
            clearInterval(this._storageSaverIntervalId);
            this._storageSaverIntervalId = null;
        }
    }

    private static _isSessionExpired() {
        if (!this._lastSessionTime) {
            return true;
        }

        const now = Math.floor(Date.now() / 1000);
        const expiration = this._lastSessionTime + this._sessionDuration;

        return now > expiration;
    }

    static async saveLastSessionTime() {
        const now = Math.floor(Date.now() / 1000);
        this._lastSessionTime = now;
        await NotiflyStorage.setItem(NotiflyStorageKeys.LAST_SESSION_TIME, now.toString());
    }

    private static async _maybeStartSession() {
        if (this._isSessionExpired()) {
            await this._initializePushSubscription();
            await EventManager.sessionStart();
        }
    }

    private static async _maybeRefreshSession() {
        if (this._isSessionExpired()) {
            await this._initializePushSubscription();
            await EventManager.sessionStart();
            await WebMessageManager.refreshState();
        }
    }

    private static async _initializePushSubscription() {
        if (this._pushSubscriptionOptions) {
            const { vapidPublicKey, askPermission, serviceWorkerPath, promptDelayMillis } =
                this._pushSubscriptionOptions;
            await registerServiceWorker(vapidPublicKey, askPermission, serviceWorkerPath, promptDelayMillis);
        }
    }

    private static async _initializeInternal() {
        await this.saveLastSessionTime();

        // Register saver if window is focused
        if (document.hasFocus()) {
            this._storageSaverIntervalId = setInterval(
                this.saveLastSessionTime.bind(this),
                LAST_SESSION_TIME_LOGGING_INTERVAL
            );
        }

        // Register listeners
        window.addEventListener('focus', this.onWindowFocus.bind(this));
        window.addEventListener('blur', this.onWindowBlur.bind(this));
    }
}
