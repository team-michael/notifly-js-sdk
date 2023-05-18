import { v5 } from 'uuid';
import { NAMESPACE } from './constants';

function generateNotiflyUserID(externalUserID?: string, deviceToken?: string, deviceID?: string): string | undefined {
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
    // based on a seed string that persists throughout the lifecycle of localStorage,
    const storedSeedString = localStorage.getItem('__notiflySeedString');
    if (storedSeedString) {
        return v5(storedSeedString, NAMESPACE.REGISTERED_USERID).replace(/-/g, '');
    } else {
        const seedString = generateRandomString(8);
        localStorage.setItem('__notiflySeedString', seedString);
        return v5(seedString, NAMESPACE.REGISTERED_USERID).replace(/-/g, '');
    }
}

function getNotiflyUserID(externalUserID?: string, deviceToken?: string | null | undefined): string | undefined {
    const storedNotiflyUserID = localStorage.getItem('__notiflyUserID');
    if (storedNotiflyUserID) {
        return storedNotiflyUserID;
    }
    if (externalUserID) {
        return generateNotiflyUserID(externalUserID, undefined);
    }
    const storedExternalUserID = localStorage.getItem('__notiflyExternalUserID');
    if (storedExternalUserID) {
        return generateNotiflyUserID(storedExternalUserID, undefined);
    }
    const storedDeviceToken = localStorage.getItem('__notiflyDeviceToken');
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
    } else if (/webOS|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|Firefox|Chrome/.test(userAgent)) {
        return 'web';
    } else {
        return 'unknown';
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
