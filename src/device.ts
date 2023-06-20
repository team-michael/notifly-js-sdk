import localForage from './localforage';

export async function setDeviceToken(deviceToken: string | null | undefined): Promise<void> {
    if (!deviceToken) {
        console.error('[Notifly] device token must be not null');
        return;
    }

    await localForage.setItem('__notiflyDeviceToken', deviceToken);
}
