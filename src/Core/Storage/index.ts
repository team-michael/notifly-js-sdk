import { generateNotiflyUserId } from '../Utils';
import { v4 } from 'uuid';
import NotiflyIndexedDBStore from './IDB';
import IdentityStore, { type NotiflyIdentity } from './IdentityStore';

export enum NotiflyStorageKeys {
    // Project
    PROJECT_ID = '__notiflyProjectID',
    USERNAME = '__notiflyUserName',
    PASSWORD = '__notiflyPassword',

    // Auth
    COGNITO_ID_TOKEN = '__notiflyCognitoIDToken',

    // User
    EXTERNAL_USER_ID = '__notiflyExternalUserID',
    NOTIFLY_DEVICE_ID = '__notiflyDeviceID',
    NOTIFLY_STATE = '__notiflyState',

    // Misc
    LAST_SESSION_TIME = '__notiflyLastSessionTime',
    NOTIFLY_NOTIFICATION_PERMISSION = '__notiflyNotificationPermission',
    SW_VERSION = '__notiflySWVersion',
}

const IDENTITY_FIELDS: Partial<Record<NotiflyStorageKeys, keyof NotiflyIdentity>> = {
    [NotiflyStorageKeys.PROJECT_ID]: 'projectId',
    [NotiflyStorageKeys.USERNAME]: 'username',
    [NotiflyStorageKeys.PASSWORD]: 'password',
    [NotiflyStorageKeys.NOTIFLY_DEVICE_ID]: 'deviceId',
    [NotiflyStorageKeys.EXTERNAL_USER_ID]: 'externalUserId',
};

export class NotiflyStore {
    private static readonly TRANSACTION_TIMEOUT = 1000;
    private static storage: NotiflyIndexedDBStore | null = null;
    private static readonly identityStore = new IdentityStore();
    private static encryptIdentity = false;

    static async initialize(projectId: string, username: string, password: string): Promise<void> {
        await this.ensureInitialized();
        await this.identityStore.updateIdentity(
            (current) => ({
                projectId,
                username,
                password,
                deviceId: current?.deviceId ?? v4(),
                externalUserId: current?.externalUserId ?? null,
            }),
            this.encryptIdentity
        );
    }

    /** Called after worker compatibility has been confirmed, or no worker is registered. */
    static async enableIdentityEncryption(): Promise<void> {
        await this.identityStore.initialize();
        this.encryptIdentity = true;
    }

    static async ensureInitialized() {
        if (!this.storage) {
            this.storage = new NotiflyIndexedDBStore('notifly', 'notiflyconfig');
        }
        return this._withTimeout(this.storage.ready());
    }

    static async getNotiflyUserId(): Promise<string> {
        const [projectId, externalUserId, deviceId] = await this.getItems([
            NotiflyStorageKeys.PROJECT_ID,
            NotiflyStorageKeys.EXTERNAL_USER_ID,
            NotiflyStorageKeys.NOTIFLY_DEVICE_ID,
        ]);

        if (!projectId || !deviceId) {
            throw new Error('Notifly storage is not initialized');
        }

        return generateNotiflyUserId(projectId, externalUserId, deviceId);
    }

    static async getItems(keys: NotiflyStorageKeys[]): Promise<Array<string | null>> {
        await this.ensureInitialized();
        const identity = keys.some((key) => IDENTITY_FIELDS[key]) ? await this.identityStore.getIdentity() : null;
        return this._withTimeout(
            Promise.all(
                keys.map(async (key) => {
                    const field = IDENTITY_FIELDS[key];
                    if (field) return identity?.[field] ?? null;
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    return (await this.storage!.getItem(key)) ?? null;
                })
            )
        );
    }

    static async getItem(key: NotiflyStorageKeys): Promise<string | null> {
        return (await this.getItems([key]))[0];
    }

    static async setItems(data: Partial<Record<NotiflyStorageKeys, string>>): Promise<void> {
        await this.ensureInitialized();
        const identity: Partial<NotiflyIdentity> = {};
        const other: [string, string][] = [];
        for (const [key, value] of Object.entries(data)) {
            const field = IDENTITY_FIELDS[key as NotiflyStorageKeys];
            if (field) identity[field] = value;
            else other.push([key, value]);
        }
        if (Object.keys(identity).length) {
            await this.identityStore.updateIdentity((current) => {
                if (!current) throw new Error('[NotiflyStore] Identity is not initialized.');
                return { ...current, ...identity };
            }, this.encryptIdentity);
        }
        if (other.length) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await this._withTimeout(this.storage!.setItems(other));
        }
    }

    static async setItem(key: NotiflyStorageKeys, value: string): Promise<void> {
        await this.setItems({ [key]: value });
    }

    static async removeItems(keys: NotiflyStorageKeys[]): Promise<void> {
        await this.ensureInitialized();
        if (keys.some((key) => IDENTITY_FIELDS[key] && key !== NotiflyStorageKeys.EXTERNAL_USER_ID)) {
            throw new Error('[NotiflyStore] Required identity fields cannot be removed.');
        }
        if (keys.includes(NotiflyStorageKeys.EXTERNAL_USER_ID)) {
            await this.identityStore.updateIdentity(
                (current) => (current ? { ...current, externalUserId: null } : null),
                this.encryptIdentity
            );
        }
        const other = keys.filter((key) => !IDENTITY_FIELDS[key]);
        if (other.length) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await this._withTimeout(this.storage!.removeItems(other));
        }
    }

    static async removeItem(key: NotiflyStorageKeys): Promise<void> {
        await this.removeItems([key]);
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
