import { v5 } from 'uuid';
import { NAMESPACE } from './constants';

function generateNotiflyUserID(externalUserID?: string, deviceToken?: string): string | undefined {
    if (externalUserID) {
        return v5(externalUserID, NAMESPACE.REGISTERED_USERID).replace(/-/g, '');
    }
    if (deviceToken) {
        return v5(deviceToken, NAMESPACE.UNREGISTERED_USERID).replace(/-/g, '');
    }
    return undefined;    
}

function getNotiflyUserID(externalUserID?: string, deviceToken?: string): string | undefined {
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

export {
    generateNotiflyUserID,
    getNotiflyUserID,
    getPlatform,
};
