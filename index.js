const { NAMESPACE, SDK_VERSION } = require('./src/constants');
const { saveCognitoIdToken } = require('./src/auth');
const { getNotiflyUserID } = require('./src/user');
const { v5, v4 } = require('uuid');

async function trackEvent(eventName, eventParams, segmentation_event_param_keys = null, isInternalEvent = false) {
    const [projectID, deviceToken, cognitoIDToken, notiflyDeviceID, externalUserID] = [
        localStorage.getItem('__notiflyProjectID'),
        localStorage.getItem('__notiflyDeviceToken'),
        localStorage.getItem('__notiflyCognitoIDToken'),
        localStorage.getItem('__notiflyDeviceID'),
        localStorage.getItem('__notiflyExternalUserID'),
    ];
    const notiflyUserID = getNotiflyUserID(deviceToken);
    const data = {
        id: v4(),
        project_id: projectID,
        name: eventName,
        event_params: eventParams,
        notifly_device_id: notiflyDeviceID,
        notifly_user_id: notiflyUserID,
        external_user_id: externalUserID,
        device_token: deviceToken,
        is_internal_event: isInternalEvent,
        segmentation_event_param_keys: segmentation_event_param_keys,
        sdk_version: SDK_VERSION,
        time: parseInt(new Date().valueOf() / 1000),
        platform: null, //TODO: platform
    };
    console.log(data);
}

async function initialize(projectID, userName, password, deviceToken) {
    if (!(projectID && userName && password && deviceToken)) {
        console.error('[Notifly] projectID, userName, password, and deviceToken must be not null');
        return false;
    }
    await saveCognitoIdToken(userName, password);
    const notiflyDeviceID = v5(deviceToken, NAMESPACE.DEVICEID);
    const notiflyUserID = getNotiflyUserID(deviceToken);
    _saveNotiflyData({
        __notiflyProjectID: projectID,
        __notiflyUserName: userName,
        __notiflyPassword: password,
        __notiflyDeviceToken: deviceToken,
        __notiflyDeviceID: notiflyDeviceID,
    });
    return true;
}

async function setUserId(userID) {
    localStorage.setItem('__notiflyExternalUserID', userID);
    // TODO: setUserProperties
}

function _saveNotiflyData(data) {
    for (const [key, val] of Object.entries(data)) {
        localStorage.setItem(key, val);
    }
}

module.exports = {
    initialize,
    trackEvent,
};
