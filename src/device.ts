import { v5 } from 'uuid';
import localForage from './localforage';
import { NAMESPACE } from './constants';

export async function setDeviceToken(deviceToken: string | null | undefined): Promise<void> {
    if (!deviceToken) {
        console.error('[Notifly] device token must be not null');
        return;
    }

    const notiflyDeviceID = v5(deviceToken, NAMESPACE.DEVICEID).replace(/-/g, '');
    await Promise.all([
        localForage.setItem('__notiflyDeviceID', notiflyDeviceID),
        localForage.setItem('__notiflyDeviceToken', deviceToken),
    ])
}
