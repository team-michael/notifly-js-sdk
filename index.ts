import { v5 } from 'uuid';
import { NAMESPACE } from './src/constants';
import { logEvent } from './src/logEvent';
import { saveCognitoIdToken } from './src/auth';
import { sessionStart } from './src/logEvent';
import { setUserId, setUserProperties, removeUserId } from './src/user';
import { getNotiflyUserID } from './src/utils';

async function initialize(
    projectID: string | null | undefined,
    userName: string | null | undefined,
    password: string | null | undefined,
    deviceToken?: string | null | undefined
): Promise<boolean> {
    if (!(projectID && userName && password)) {
        console.error('[Notifly] projectID, userName and password must be not null');
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
    return true;
}

function _saveNotiflyData(data: Record<string, string>): void {
    for (const [key, val] of Object.entries(data)) {
        localStorage.setItem(key, val as string);
    }
}

export default {
    initialize,
    trackEvent: logEvent,
    setUserProperties,
    removeUserId,
    setUserId,
};
