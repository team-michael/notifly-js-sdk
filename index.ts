import { v5 } from 'uuid';
import { NAMESPACE } from './src/constants';
import { logEvent, sessionStart } from './src/logEvent';
import { saveCognitoIdToken } from './src/auth';
import { setUserId, setUserProperties, removeUserId } from './src/user';
import { getNotiflyUserID } from './src/utils';
import { setDeviceToken } from './src/device';
import { syncState } from './src/state';
import { registerServiceWorker } from './src/push';

let isNotiflyInitialized = false;

async function initialize(
    projectID: string | null | undefined,
    userName: string | null | undefined,
    password: string | null | undefined,
    deviceToken?: string | null | undefined
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

    await saveCognitoIdToken(userName, password);

    let notiflyDeviceID = undefined;
    let notiflyUserID = undefined;
    if (deviceToken) {
        notiflyDeviceID = v5(deviceToken, NAMESPACE.DEVICEID).replace(/-/g, '');
        // Utilize cached notiflyUserID if it exists
        notiflyUserID = getNotiflyUserID(undefined, deviceToken);
    }

    _saveNotiflyData({
        __notiflyProjectID: projectID,
        __notiflyUserName: userName,
        __notiflyPassword: password,
        ...(deviceToken !== null && deviceToken !== undefined && { __notiflyDeviceToken: deviceToken }),
        ...(notiflyDeviceID !== undefined && { __notiflyDeviceID: notiflyDeviceID }),
        ...(notiflyUserID !== undefined && { __notiflyUserID: notiflyUserID }),
    });
    await sessionStart();
    isNotiflyInitialized = true;

    if (notiflyUserID) {
        await syncState(projectID, notiflyUserID);
    }

    return true;
}

function _saveNotiflyData(data: Record<string, string>): void {
    for (const [key, val] of Object.entries(data)) {
        localStorage.setItem(key, val as string);
    }
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
    return logEvent(eventName, eventParams, segmentationEventParamKeys, false, 1);
}

const notifly = {
    initialize,
    trackEvent,
    setUserProperties,
    removeUserId,
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
