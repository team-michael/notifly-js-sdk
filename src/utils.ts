import { v5 } from 'uuid';
import * as localForage from 'localforage';
import { NAMESPACE } from './constants';

async function generateNotiflyUserID(externalUserID?: string, deviceToken?: string, deviceID?: string): Promise<string | undefined> {
    if (externalUserID) {
        return v5(externalUserID, NAMESPACE.REGISTERED_USERID).replace(/-/g, '');
    }
    if (deviceToken) {
        return v5(deviceToken, NAMESPACE.UNREGISTERED_USERID).replace(/-/g, '');
    }
    if (deviceID) {
        return v5(deviceID, NAMESPACE.UNREGISTERED_USERID).replace(/-/g, '');
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

async function getNotiflyUserID(externalUserID?: string, deviceToken?: string | null | undefined): Promise<string | undefined> {
    const storedNotiflyUserID = await localForage.getItem<string>('__notiflyUserID');
    if (storedNotiflyUserID) {
        return storedNotiflyUserID;
    }
    if (externalUserID) {
        return generateNotiflyUserID(externalUserID, undefined);
    }
    const storedExternalUserID = await localForage.getItem<string>('__notiflyExternalUserID');
    if (storedExternalUserID) {
        return generateNotiflyUserID(storedExternalUserID, undefined);
    }
    const storedDeviceToken = await localForage.getItem<string>('__notiflyDeviceToken');
    if (storedDeviceToken) {
        return generateNotiflyUserID(undefined, storedDeviceToken);
    }
    if (deviceToken) {
        return generateNotiflyUserID(undefined, deviceToken);
    }
    return undefined;
}

function getPlatform(): string {
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

export { generateNotiflyUserID, getNotiflyUserID, getPlatform };
