import { v4, v5 } from 'uuid';

import { NAMESPACE } from '../Constants';

import { NotiflyStorage, NotiflyStorageKeys } from '../Storage';

export async function initializeNotiflyStorage(
    projectId: string,
    username: string,
    password: string,
    deviceToken?: string
) {
    const [_token, externalUserId] = await NotiflyStorage.getItems([
        NotiflyStorageKeys.NOTIFLY_DEVICE_TOKEN,
        NotiflyStorageKeys.EXTERNAL_USER_ID,
    ]);
    const token = deviceToken || _token;

    const [deviceId, notiflyUserId] = await Promise.all([
        getInitialDeviceId(token),
        getInitialNotiflyUserId(projectId, externalUserId, token),
    ]);

    await NotiflyStorage.setItems({
        __notiflyProjectID: projectId,
        __notiflyUserName: username,
        __notiflyPassword: password,
        ...(token ? { __notiflyDeviceToken: token } : {}),
        __notiflyDeviceID: deviceId,
        __notiflyUserID: notiflyUserId,
    });
}

export async function generateNotiflyUserId(
    projectID: string,
    externalUserID?: string | null,
    deviceToken?: string | null,
    deviceID?: string | null
) {
    if (externalUserID) {
        return v5(`${projectID}${externalUserID}`, NAMESPACE.REGISTERED_USERID).replace(/-/g, '');
    }
    if (deviceToken) {
        return v5(`${projectID}${deviceToken}`, NAMESPACE.UNREGISTERED_USERID).replace(/-/g, '');
    }
    if (deviceID) {
        return v5(`${projectID}${deviceID}`, NAMESPACE.UNREGISTERED_USERID).replace(/-/g, '');
    }

    // If externalUserID, deviceToken, and deviceID do not exist, generate a random ID
    // based on a seed string that persists throughout the lifecycle of localForage.,
    const storedSeedString = await NotiflyStorage.getItem(NotiflyStorageKeys.SEED_STRING);
    if (storedSeedString) {
        return v5(storedSeedString, NAMESPACE.REGISTERED_USERID).replace(/-/g, '');
    } else {
        const seedString = generateRandomString(8);
        await NotiflyStorage.setItem(NotiflyStorageKeys.SEED_STRING, seedString);
        return v5(seedString, NAMESPACE.REGISTERED_USERID).replace(/-/g, '');
    }
}

export async function getInitialNotiflyUserId(
    projectID: string,
    externalUserID?: string | null,
    deviceToken?: string | null
) {
    const storedNotiflyUserID = await NotiflyStorage.getItem(NotiflyStorageKeys.NOTIFLY_USER_ID);
    if (storedNotiflyUserID) {
        return storedNotiflyUserID;
    }

    return await generateNotiflyUserId(projectID, externalUserID, deviceToken);
}

export async function getInitialDeviceId(deviceToken?: string | null) {
    const storedNotiflyDeviceID = await NotiflyStorage.getItem(NotiflyStorageKeys.NOTIFLY_DEVICE_ID);
    if (storedNotiflyDeviceID) {
        return storedNotiflyDeviceID;
    }

    return deviceToken ? v5(deviceToken, NAMESPACE.DEVICEID).replace(/-/g, '') : v4();
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
