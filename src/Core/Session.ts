import { getSdkConfiguration, type SdkConfiguration } from './API/Configuration';

import { LAST_SESSION_TIME_LOGGING_INTERVAL } from '../Constants';

import { NotiflyStorage, NotiflyStorageKeys } from './Storage';
import { UserStateManager } from './User/State';
import { registerServiceWorker } from './Push';
import { EventLogger } from './Event';
import { WebMessageManager } from './WebMessages/Manager';

export class SessionManager {
    private static _lastSessionTime: number | null = null;
    private static _sdkConfiguration: SdkConfiguration | undefined;
    private static _storageSaverIntervalId: ReturnType<typeof setInterval> | null = null;

    static async initialize() {
        const parsedLastSessionTime = parseInt(
            (await NotiflyStorage.getItem(NotiflyStorageKeys.LAST_SESSION_TIME)) || '0',
            10
        );

        if (!parsedLastSessionTime || isNaN(parsedLastSessionTime)) {
            this._lastSessionTime = null;
        } else {
            this._lastSessionTime = parsedLastSessionTime;
        }

        this._sdkConfiguration = await getSdkConfiguration();

        await WebMessageManager.initialize(this._isSessionExpired());
        await this._maybeStartSession();
        await this._initializeInternal();
    }

    static async saveLastSessionTime() {
        const now = Math.floor(Date.now() / 1000);
        this._lastSessionTime = now;
        await NotiflyStorage.setItem(NotiflyStorageKeys.LAST_SESSION_TIME, now.toString());
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
        if (!this._sdkConfiguration) {
            return true;
        }

        const now = Math.floor(Date.now() / 1000);
        const expiration = this._lastSessionTime + this._sdkConfiguration.sessionDuration;

        return now > expiration;
    }

    private static async _maybeStartSession() {
        if (this._isSessionExpired()) {
            await this._initializePushSubscription();
            await EventLogger.sessionStart();
        }
    }

    private static async _maybeRefreshSession() {
        if (this._isSessionExpired()) {
            await this._initializePushSubscription();
            await EventLogger.sessionStart();
            await UserStateManager.refresh();
        }
    }

    private static async _initializePushSubscription() {
        if (!this._sdkConfiguration || !this._sdkConfiguration.useWebPush || !this._sdkConfiguration.webPushOptions) {
            return;
        }

        const { vapidPublicKey, askPermission, serviceWorkerPath, promptDelayMillis } =
            this._sdkConfiguration.webPushOptions;
        await registerServiceWorker(vapidPublicKey, askPermission, serviceWorkerPath, promptDelayMillis);
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
