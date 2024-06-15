import { v4, v5 } from 'uuid';
import { HashNamespace } from '../../Constants';
import { NotiflyStorage, NotiflyStorageKeys } from '../Storage';

export * from './Timezone';

export async function initializeNotiflyStorage(projectId: string, username: string, password: string) {
    await NotiflyStorage.ensureInitialized();
    const itemsToSet: Partial<Record<NotiflyStorageKeys, string>> = {
        [NotiflyStorageKeys.PROJECT_ID]: projectId,
        [NotiflyStorageKeys.USERNAME]: username,
        [NotiflyStorageKeys.PASSWORD]: password,
    };
    const existingDeviceId = await NotiflyStorage.getItem(NotiflyStorageKeys.NOTIFLY_DEVICE_ID);
    if (!existingDeviceId) {
        itemsToSet[NotiflyStorageKeys.NOTIFLY_DEVICE_ID] = v4();
    }
    await NotiflyStorage.setItems(itemsToSet);
}

export function isValidProjectId(projectId: string) {
    const regex = /^(?:[0-9a-fA-F]{32})$/;
    return regex.test(projectId);
}

export function generateNotiflyUserId(projectId: string, externalUserId: string | null, deviceId: string) {
    return externalUserId
        ? v5(`${projectId}${externalUserId}`, HashNamespace.REGISTERED_USERID).replace(/-/g, '')
        : v5(`${projectId}${deviceId}`, HashNamespace.UNREGISTERED_USERID).replace(/-/g, '');
}

export function getPlatform(): string {
    if (typeof navigator === 'undefined') {
        console.warn('[Notifly] Not running in a client-side environment. Cannot determine platform.');
        return 'unknown';
    }
    const userAgent = navigator.userAgent;

    if (/iPad|iPhone|iPod/.test(userAgent)) {
        return 'ios';
    } else if (/Android/.test(userAgent)) {
        return 'android';
    } else {
        // If the platform is not ios or android, assume it is web.
        return 'web';
    }
}

export function generateRandomString(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charactersLength);
        result += characters.charAt(randomIndex);
    }

    return result;
}

export function mapNotificationPermissionToEnum(permission: NotificationPermission): number {
    if (permission === 'denied') {
        return 0; // DENIED
    }

    if (permission === 'granted') {
        return 1; // AUTHORIZED
    }

    return -1; // NOT_DETERMINED
}

export const getGlobalScope = (): typeof globalThis | undefined => {
    if (typeof globalThis !== 'undefined') {
        return globalThis;
    }
    if (typeof window !== 'undefined') {
        return window;
    }
    if (typeof self !== 'undefined') {
        return self;
    }
    if (typeof global !== 'undefined') {
        return global;
    }
    return undefined;
};

export const getTimestampMicroseconds = (): number => {
    if (window.performance && 'now' in window.performance && 'timeOrigin' in window.performance) {
        return Math.floor((window.performance.now() + window.performance.timeOrigin) * 1000);
    }
    return Date.now() * 1000;
};

export function removeKeys(object: Record<string, unknown>, keys: string[]): Record<string, unknown> {
    return Object.keys(object).reduce((acc, key) => {
        if (!keys.includes(key)) {
            acc[key] = object[key];
        }
        return acc;
    }, {} as Record<string, unknown>);
}
