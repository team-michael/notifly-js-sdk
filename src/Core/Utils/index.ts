import { v4, v5 } from 'uuid';
import { NAMESPACE } from '../../Constants';
import { NotiflyStorage, NotiflyStorageKeys } from '../Storage';

export async function initializeNotiflyStorage(projectId: string, username: string, password: string) {
    await NotiflyStorage.ensureInitialized();
    await NotiflyStorage.setItems({
        [NotiflyStorageKeys.PROJECT_ID]: projectId,
        [NotiflyStorageKeys.USERNAME]: username,
        [NotiflyStorageKeys.PASSWORD]: password,
    });
    await storeUserIdentity();
}

export async function storeUserIdentity() {
    const [projectId, externalUserId, _deviceId] = await NotiflyStorage.getItems([
        NotiflyStorageKeys.PROJECT_ID,
        NotiflyStorageKeys.EXTERNAL_USER_ID,
        NotiflyStorageKeys.NOTIFLY_DEVICE_ID,
    ]);

    if (!projectId) {
        throw new Error('Project ID should be set when re-initializing user identity.');
    }
    const deviceId = _deviceId || v4();
    const notiflyUserId = generateNotiflyUserId(projectId, externalUserId, deviceId);

    await NotiflyStorage.setItems({
        [NotiflyStorageKeys.NOTIFLY_USER_ID]: notiflyUserId,
        [NotiflyStorageKeys.NOTIFLY_DEVICE_ID]: deviceId,
    });
}

export function generateNotiflyUserId(projectId: string, externalUserId: string | null, deviceId: string) {
    return externalUserId
        ? v5(`${projectId}${externalUserId}`, NAMESPACE.REGISTERED_USERID).replace(/-/g, '')
        : v5(`${projectId}${deviceId}`, NAMESPACE.UNREGISTERED_USERID).replace(/-/g, '');
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
