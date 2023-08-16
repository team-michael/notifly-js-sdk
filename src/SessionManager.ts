import { NotiflyStorage, NotiflyStorageKeys } from './Storage';

export class SessionManager {
    private static _lastSessionTime: number | null = null;
    private static _sessionDuration: number = 30 * 60;

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

        if (!sessionDuration) {
            this._sessionDuration = 30 * 60;
        } else {
            if (sessionDuration < 5 * 60) {
                console.warn('[Notifly] Session duration must be at least 5 minutes. Defaulting to 30 minutes.');
                this._sessionDuration = 30 * 60;
            } else {
                this._sessionDuration = sessionDuration;
            }
        }
    }

    static isSessionExpired() {
        if (!this._lastSessionTime) {
            return true;
        }

        const now = Math.floor(Date.now() / 1000);
        const expiration = this._lastSessionTime + this._sessionDuration;

        return now > expiration;
    }
}
