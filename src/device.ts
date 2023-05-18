import { v5 } from 'uuid';
import { NAMESPACE } from './constants';

export async function setDeviceToken(deviceToken: string | null | undefined): Promise<void> {
    if (!deviceToken) {
        console.error('[Notifly] device token must be not null');
        return;
    }

    // Set device token
    localStorage.setItem('__notiflyDeviceToken', deviceToken);

    // Set device ID
    const notiflyDeviceID = v5(deviceToken, NAMESPACE.DEVICEID).replace(/-/g, '');
    localStorage.setItem('__notiflyDeviceID', notiflyDeviceID);
}
