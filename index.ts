import { v5 } from 'uuid';
import { NAMESPACE } from './src/constants';
import { logEvent } from './src/logEvent';
import { saveCognitoIdToken } from './src/auth';
import { sessionStart } from './src/logEvent';
import { setUserId, setUserProperties, removeUserId } from './src/user';

async function initialize(projectID: string | null | undefined, userName: string | null | undefined, password: string | null | undefined, deviceToken: string | null | undefined): Promise<boolean> {
    if (!(projectID && userName && password && deviceToken)) {
        console.error('[Notifly] projectID, userName, password, and deviceToken must be not null');
        return false;
    }
    await saveCognitoIdToken(userName, password);
    const notiflyDeviceID = v5(deviceToken, NAMESPACE.DEVICEID).replace(/-/g, '');
    // const notiflyUserID = getNotiflyUserID(deviceToken);
    _saveNotiflyData({
        __notiflyProjectID: projectID,
        __notiflyUserName: userName,
        __notiflyPassword: password,
        __notiflyDeviceToken: deviceToken,
        __notiflyDeviceID: notiflyDeviceID,
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
