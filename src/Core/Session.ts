import { getSdkConfiguration, type SdkConfiguration } from './API/Configuration';

import { LAST_SESSION_TIME_LOGGING_INTERVAL } from '../Constants';

import { NotiflyStore, NotiflyStorageKeys } from './Storage';
import { isIdentityCryptoSupported } from './Storage/IdentityCrypto';
import { UserStateManager } from './User/State';
import { EventLogger } from './Event';
import { WebMessageManager } from './WebMessages/Manager';
import { NotiflyWebPushManager } from './Push';

export class SessionManager {
    private static _lastSessionTime: number | null = null;
    private static _sdkConfiguration: SdkConfiguration | undefined;
    private static _storageSaverIntervalId: ReturnType<typeof setInterval> | null = null;

    static async initialize() {
        const parsedLastSessionTime = parseInt(
            (await NotiflyStore.getItem(NotiflyStorageKeys.LAST_SESSION_TIME)) || '0',
            10
        );

        if (!parsedLastSessionTime || isNaN(parsedLastSessionTime)) {
            this._lastSessionTime = null;
        } else {
            this._lastSessionTime = parsedLastSessionTime;
        }

        this._sdkConfiguration = await getSdkConfiguration();

        await WebMessageManager.initialize();
        await this._initializePushManager();
        try {
            if (
                isIdentityCryptoSupported() &&
                (await NotiflyWebPushManager.canEncryptIdentity(
                    this._sdkConfiguration.webPushOptions?.serviceWorkerPath
                ))
            ) {
                await NotiflyStore.enableIdentityEncryption();
            }
        } catch (error) {
            console.warn(
                '[Notifly] Identity encryption could not be completed. It will be retried on the next initialization.',
                error
            );
            // Continue only if the stored identity is still readable after the failed migration.
            await NotiflyStore.getNotiflyUserId();
        }
        await this._maybeStartSession();
        await this._initializeInternal();
    }

    static async saveLastSessionTime() {
        try {
            const now = Math.floor(Date.now() / 1000);
            this._lastSessionTime = now;
            await NotiflyStore.setItem(NotiflyStorageKeys.LAST_SESSION_TIME, now.toString());
        } catch (e) {
            /* Do nothing */
        }
    }

    static onWindowFocus() {
        if (this._storageSaverIntervalId) {
            // This might not happen, but just in case
            clearInterval(this._storageSaverIntervalId);
            this._storageSaverIntervalId = null;
        }

        this._storageSaverIntervalId = setInterval(
            this.saveLastSessionTime.bind(this),
            LAST_SESSION_TIME_LOGGING_INTERVAL
        );

        this._maybeRefreshSession().catch((e) => {
            console.error('[Notifly] Failed to refresh session', e);
        });
    }

    static onWindowUnfocus() {
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
            await EventLogger.sessionStart();
        }
    }

    private static async _maybeRefreshSession() {
        if (this._isSessionExpired()) {
            await this.saveLastSessionTime();
            await EventLogger.sessionStart();
            await UserStateManager.refresh();
        }
    }

    private static async _initializePushManager() {
        if (!this._sdkConfiguration || !this._sdkConfiguration.useWebPush || !this._sdkConfiguration.webPushOptions) {
            return;
        }

        const {
            vapidPublicKey,
            askPermission,
            serviceWorkerPath,
            promptDelayMillis,
            promptDefaultLanguage,
            promptDesignParams,
        } = this._sdkConfiguration.webPushOptions;

        await NotiflyWebPushManager.initialize(
            vapidPublicKey,
            askPermission,
            serviceWorkerPath,
            promptDelayMillis,
            promptDefaultLanguage,
            promptDesignParams
        );
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
        window.addEventListener('blur', this.onWindowUnfocus.bind(this));
        window.addEventListener('beforeunload', this.onWindowUnfocus.bind(this));
        window.addEventListener('pagehide', (event) => {
            if (event.persisted) {
                this.onWindowUnfocus.call(this);
            }
        });
    }
}
