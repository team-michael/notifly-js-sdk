import { v5 } from 'uuid';
import { NAMESPACE } from './constants';

function getNotiflyUserID(deviceToken: string | null | undefined): string | null {
    if (!deviceToken) {
        console.warn('[Notifly] getNotiflyUserID: deviceToken is null');
        return null;
    }
    const externalUserID = localStorage.getItem('__notiflyExternalUserID');
    if (externalUserID) {
        return v5(externalUserID, NAMESPACE.REGISTERED_USERID).replace(/-/g, '');
    }
    return v5(deviceToken, NAMESPACE.UNREGISTERED_USERID).replace(/-/g, '');
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
    getNotiflyUserID,
    getPlatform,
};
