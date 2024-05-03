import NotiflyIndexedDBStore from './IDB';

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
    NOTIFLY_STATE = '__notiflyState',

    // Misc
    LAST_SESSION_TIME = '__notiflyLastSessionTime',
    NOTIFLY_NOTIFICATION_PERMISSION = '__notiflyNotificationPermission',
    SW_VERSION = '__notiflySWVersion',
}

export class NotiflyStorage {
    private static readonly TRANSACTION_TIMEOUT = 1000;
    private static storage: NotiflyIndexedDBStore | null = null;

    static async ensureInitialized() {
        if (!this.storage) {
            this.storage = new NotiflyIndexedDBStore('notifly', 'notiflyconfig');
        }
        return this._withTimeout(this.storage.ready());
    }

    static async getItems(keys: NotiflyStorageKeys[]): Promise<Array<string | null>> {
        await this.ensureInitialized();
        return this._withTimeout(Promise.all(keys.map((key) => this.getItem(key))));
    }

    static async getItem(key: NotiflyStorageKeys): Promise<string | null> {
        await this.ensureInitialized();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const value = await this._withTimeout(this.storage!.getItem(key));
        return value ?? null;
    }

    static async setItems(data: Partial<Record<NotiflyStorageKeys, string>>): Promise<void> {
        await this.ensureInitialized();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this._withTimeout(this.storage!.setItems(Object.entries(data)));
    }

    static async setItem(key: NotiflyStorageKeys, value: string): Promise<void> {
        await this.ensureInitialized();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this._withTimeout(this.storage!.setItem(key, value));
    }

    static async removeItems(keys: NotiflyStorageKeys[]): Promise<void> {
        await this.ensureInitialized();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this._withTimeout(this.storage!.removeItems(keys));
    }

    static async removeItem(key: NotiflyStorageKeys): Promise<void> {
        await this.ensureInitialized();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this._withTimeout(this.storage!.removeItem(key));
    }

    private static async _withTimeout<T = unknown>(
        promise: Promise<T>,
        timeout = this.TRANSACTION_TIMEOUT
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            setTimeout(() => reject(new Error('Working with storage is not finished in a reasonable time')), timeout);
            promise.then(resolve).catch(reject);
        });
    }
}
