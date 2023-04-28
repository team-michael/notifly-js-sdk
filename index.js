const { NAMESPACE } = require('./src/constants');
const { logEvent } = require('./src/logEvent');
const { saveCognitoIdToken } = require('./src/auth');
const { setUserProperties, removeUserId } = require('./src/user');
const { v5 } = require('uuid');
const { sessionStart } = require('./src/logEvent');

async function initialize(projectID, userName, password, deviceToken) {
    if (!(projectID && userName && password && deviceToken)) {
        console.error('[Notifly] projectID, userName, password, and deviceToken must be not null');
        return false;
    }
    await saveCognitoIdToken(userName, password);
    const notiflyDeviceID = v5(deviceToken, NAMESPACE.DEVICEID);
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

async function setUserId(userID) {
    if (!userID) {
        await removeUserId();
        return;
    }
    try {
        await setUserProperties({
            external_user_id: userID,
        });
    } catch (err) {
        console.warn('[Notifly] setUserId failed');
    }
}

function _saveNotiflyData(data) {
    for (const [key, val] of Object.entries(data)) {
        localStorage.setItem(key, val);
    }
}

module.exports = {
    initialize,
    trackEvent: logEvent,
    setUserProperties,
    removeUserId,
    setUserId,
};
