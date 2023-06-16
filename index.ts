import { v5 } from 'uuid';
import localForage from './src/localforage';

import { NAMESPACE } from './src/constants';
import { logEvent, sessionStart } from './src/logEvent';
import { saveCognitoIdToken } from './src/auth';
import { setUserId, setUserProperties, deleteUser } from './src/user';
import { getNotiflyUserID, getNotiflyDeviceID } from './src/utils';
import { setDeviceToken } from './src/device';
import { syncState } from './src/state';
import { registerServiceWorker } from './src/push';

let isNotiflyInitialized = false;

async function initialize(
    projectID: string,
    userName: string,
    password: string,
    deviceToken?: string
): Promise<boolean> {
    if (isNotiflyInitialized) {
        return true;
    }

    if (!(projectID && userName && password)) {
        console.error('[Notifly] projectID, userName and password must be not null');
        return false;
    }

    if (typeof window === 'undefined') {
        console.error(
            '[Notifly] The SDK requires a browser environment to function properly. Please ensure that you are using the SDK within a supported browser environment.'
        );
        return false;
    }

    const [notiflyUserID, notiflyDeviceID, _] = await Promise.all([
        getNotiflyUserID(projectID, undefined, deviceToken),
        getNotiflyDeviceID(deviceToken),
        saveCognitoIdToken(userName, password),
    ]);

    await _saveNotiflyData({
        __notiflyProjectID: projectID,
        __notiflyUserName: userName,
        __notiflyPassword: password,
        __notiflyDeviceID: notiflyDeviceID,
        __notiflyUserID: notiflyUserID,
        ...(deviceToken !== null && deviceToken !== undefined && { __notiflyDeviceToken: deviceToken }),
    });

    await syncState(projectID, notiflyUserID);

    await sessionStart();
    isNotiflyInitialized = true;


    return true;
}

async function _saveNotiflyData(data: Record<string, string>): Promise<void> {
    const promises = Object.entries(data).map(([key, val]) => {
        return localForage.setItem(key, val as string);
    });

    await Promise.all(promises);
}

// For testing purposes only
function resetInitialization(): void {
    isNotiflyInitialized = false;
}

function trackEvent(
    eventName: string,
    eventParams: Record<string, any>,
    segmentationEventParamKeys: string[] | null = null
): Promise<void> {
    return logEvent(eventName, eventParams, segmentationEventParamKeys, false);
}

const notifly = {
    initialize,
    trackEvent,
    setUserProperties,
    deleteUser,
    setUserId,
    setDeviceToken,
    resetInitialization,
    registerServiceWorker,
};

// Check if the code is running in a browser environment before assigning to `window`
if (typeof window !== 'undefined') {
    (window as any).notifly = notifly;
}

export default notifly;
