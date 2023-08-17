import { LAST_SESSION_TIME_LOGGING_INTERVAL } from './Constants';

import { NotiflyStorage, NotiflyStorageKeys } from './Storage';

export class SessionManager {
    private static _lastSessionTime: number | null = null;
    private static _sessionDuration: number = 30 * 60;
    private static _storageSaverIntervalId: ReturnType<typeof setInterval> | null = null;

    static async initialize(sessionDuration?: number) {
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
    }

    static async start() {
        // DELETE LATER
        console.log('SessionManager.start');

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

    static onWindowFocus() {
        // DELETE LATER
        console.log('onWindowFocus');
        if (this._storageSaverIntervalId) {
            // This might not happen, but just in case
            clearInterval(this._storageSaverIntervalId);
        }

        this._storageSaverIntervalId = setInterval(
            this.saveLastSessionTime.bind(this),
            LAST_SESSION_TIME_LOGGING_INTERVAL
        );
    }

    static onWindowBlur() {
        // DELETE LATER
        console.log('onWindowBlur');
        if (this._storageSaverIntervalId) {
            clearInterval(this._storageSaverIntervalId);
        }
    }

    static isSessionExpired() {
        // DELETE LATER
        console.log('lastSessionTime', this._lastSessionTime);
        console.log('sessionDuration', this._sessionDuration);
        console.log('now', Math.floor(Date.now() / 1000));

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
}
