import { v4, v5 } from 'uuid';
import localForage from './LocalForage';
import { NAMESPACE } from './Constants';

async function generateNotiflyUserID(
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
    const storedSeedString = await localForage.getItem<string>('__notiflySeedString');
    if (storedSeedString) {
        return v5(storedSeedString, NAMESPACE.REGISTERED_USERID).replace(/-/g, '');
    } else {
        const seedString = generateRandomString(8);
        await localForage.setItem('__notiflySeedString', seedString);
        return v5(seedString, NAMESPACE.REGISTERED_USERID).replace(/-/g, '');
    }
}

async function getNotiflyUserID(projectID: string, externalUserID?: string, deviceToken?: string) {
    const storedNotiflyUserID = await localForage.getItem<string>('__notiflyUserID');
    if (storedNotiflyUserID) {
        return storedNotiflyUserID;
    }

    const id = externalUserID || (await localForage.getItem<string>('__notiflyExternalUserID'));
    const token = (await localForage.getItem<string>('__notiflyDeviceToken')) || deviceToken;

    return generateNotiflyUserID(projectID, id, token);
}

async function getNotiflyDeviceID(deviceToken?: string) {
    const storedNotiflyDeviceID = await localForage.getItem<string>('__notiflyDeviceID');
    if (storedNotiflyDeviceID) {
        return storedNotiflyDeviceID;
    }

    const token = deviceToken || (await localForage.getItem<string>('__notiflyDeviceToken'));
    if (token) {
        return v5(token, NAMESPACE.DEVICEID).replace(/-/g, '');
    }
    return v4();
}

function getPlatform(): string {
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

function generateRandomString(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charactersLength);
        result += characters.charAt(randomIndex);
    }

    return result;
}

export { generateNotiflyUserID, getNotiflyUserID, getNotiflyDeviceID, getPlatform };
