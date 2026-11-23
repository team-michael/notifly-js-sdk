import { generateNotiflyUserId } from '../Utils';
import { ProtectedIdentityStore } from './ProtectedIdentityStore';
import { StorageMigration } from './StorageMigration';
import { checkWorkerCompatibility } from './WorkerCompatibility';
import {
    ProtectedSnapshot,
    ProtectedValues,
    ProtectedStorageError,
    PROTECTED_KEYS,
    STATE_KEY,
} from './ProtectedStorageTypes';

export enum NotiflyStorageKeys {
    PROJECT_ID = '__notiflyProjectID',
    USERNAME = '__notiflyUserName',
    PASSWORD = '__notiflyPassword',
    COGNITO_ID_TOKEN = '__notiflyCognitoIDToken',
    EXTERNAL_USER_ID = '__notiflyExternalUserID',
    NOTIFLY_DEVICE_ID = '__notiflyDeviceID',
    NOTIFLY_STATE = '__notiflyState',
    LAST_SESSION_TIME = '__notiflyLastSessionTime',
    NOTIFLY_NOTIFICATION_PERMISSION = '__notiflyNotificationPermission',
    SW_VERSION = '__notiflySWVersion',
}
function protectedField(key: string): keyof ProtectedValues | undefined {
    return Object.prototype.hasOwnProperty.call(PROTECTED_KEYS, key)
        ? PROTECTED_KEYS[key as keyof typeof PROTECTED_KEYS]
        : undefined;
}
export class NotiflyStorage {
    private static readonly store = new ProtectedIdentityStore();

    static async initializeIdentity(
        input: { projectId: string; username: string; password: string },
        createId: () => string,
        workerPath?: string
    ) {
        return new StorageMigration(
            this.store,
            async () =>
                checkWorkerCompatibility(workerPath, !!(await this.store.configuration(['__notiflySWVersion']))[0]),
            createId
        ).initialize(input);
    }
    static async getIdentitySnapshot(): Promise<ProtectedSnapshot> {
        const result = await this.store.read();
        if (!result) throw new ProtectedStorageError('INVALID_IDENTITY');
        return result;
    }
    static async compareAndSetExternalUserId(value: string | null, revision: number): Promise<ProtectedSnapshot> {
        return this.store.patch({ externalUserId: value }, revision);
    }
    static async getNotiflyUserId(): Promise<string> {
        const { values } = await this.getIdentitySnapshot();
        return generateNotiflyUserId(values.projectId, values.externalUserId, values.deviceId);
    }
    static async getItems(keys: NotiflyStorageKeys[]): Promise<Array<string | null>> {
        const identity = keys.some((key) => protectedField(key)) ? await this.getIdentitySnapshot() : null;
        const configKeys = keys.filter((key) => !protectedField(key) && key !== STATE_KEY);
        const configuration = await this.store.configuration(configKeys);
        return keys.map((key) => {
            const field = protectedField(key);
            return field ? identity!.values[field] : key === STATE_KEY ? null : configuration[configKeys.indexOf(key)];
        });
    }
    static async getItem(key: NotiflyStorageKeys): Promise<string | null> {
        return (await this.getItems([key]))[0];
    }
    static async setItems(data: Partial<Record<NotiflyStorageKeys, string>>): Promise<void> {
        await this.mutate(Object.entries(data) as Array<[NotiflyStorageKeys, string]>);
    }
    static async setItem(key: NotiflyStorageKeys, value: string): Promise<void> {
        await this.mutate([[key, value]]);
    }
    static async removeItems(keys: NotiflyStorageKeys[]): Promise<void> {
        await this.mutate(keys.map((key) => [key, null]));
    }
    static async removeItem(key: NotiflyStorageKeys): Promise<void> {
        await this.removeItems([key]);
    }

    private static async mutate(entries: Array<[NotiflyStorageKeys, string | null]>): Promise<void> {
        const patch: Partial<ProtectedValues> = {};
        const config: Array<[string, string | null]> = [];
        for (const [key, value] of entries) {
            const field = protectedField(key);
            if (field) {
                if (field !== 'externalUserId' && value === null) throw new ProtectedStorageError('INVALID_IDENTITY');
                Object.assign(patch, { [field]: value });
            } else if (key !== STATE_KEY) config.push([key, value]);
        }
        if (Object.keys(patch).length) {
            const snapshot = await this.getIdentitySnapshot();
            await this.store.patch(patch, snapshot.revision);
        }
        if (config.length) await this.store.writeConfiguration(config);
    }
}
