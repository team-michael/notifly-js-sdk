import storage from './LocalForage';

export enum NotiflyStorageKeys {
    // Project
    PROJECT_ID = '__notiflyProjectID',
    USERNAME = '__notiflyUserName',
    PASSWORD = '__notiflyPassword',

    // Auth
    COGNITO_ID_TOKEN = '__notiflyCognitoIDToken',

    // User
    NOTIFLY_USER_ID = '__notiflyUserID',
    EXTERNAL_USER_ID = '__notiflyExternalUserID',
    NOTIFLY_DEVICE_ID = '__notiflyDeviceID',
    NOTIFLY_USER_STATE = '__notiflyUserState',

    // Misc
    LAST_SESSION_TIME = '__notiflyLastSessionTime',
    NOTIFLY_NOTIFICATION_PERMISSION = '__notiflyNotificationPermission',
    SW_VERSION = '__notiflySWVersion',
}

export class NotiflyStorage {
    static async ensureInitialized() {
        await storage.ready();
    }

    static async getItems(keys: NotiflyStorageKeys[]): Promise<Array<string | null>> {
        return Promise.all(keys.map((key) => this.getItem(key)));
    }

    static async getItem(key: NotiflyStorageKeys): Promise<string | null> {
        return (await this._get(key)) ?? null;
    }

    static async setItems(data: Partial<Record<NotiflyStorageKeys, string>>): Promise<void> {
        await Promise.all(Object.entries(data).map(([key, value]) => this.setItem(key as NotiflyStorageKeys, value)));
    }

    static async setItem(key: NotiflyStorageKeys, value: string): Promise<void> {
        await this._set(key, value);
    }

    static async removeItems(keys: NotiflyStorageKeys[]): Promise<void> {
        await Promise.all(keys.map((key) => this.removeItem(key)));
    }

    static async removeItem(key: NotiflyStorageKeys): Promise<void> {
        await this._remove(key);
    }

    private static async _get(key: string): Promise<string | null> {
        return storage.getItem(key);
    }

    private static async _set(key: string, value: string): Promise<void> {
        await storage.setItem(key, value);
    }

    private static async _remove(key: string): Promise<void> {
        await storage.removeItem(key);
    }
}
