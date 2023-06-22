import localForage from './localforage';

/**
 * Sets the device token for the current device.
 *
 * @param {string | null | undefined} deviceToken - A nullable, optional string containing the device token to set.
 * @returns {Promise<void>}
 */
export async function setDeviceToken(deviceToken: string | null | undefined): Promise<void> {
    if (!deviceToken) {
        console.error('[Notifly] device token must be not null');
        return;
    }

    await localForage.setItem('__notiflyDeviceToken', deviceToken);
}
