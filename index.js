const { NAMESPACE } = require('./src/constants');
const { logEvent } = require('./src/logEvent');
const { saveCognitoIdToken } = require('./src/auth');
const { getNotiflyUserID } = require('./src/user');
const { v5 } = require('uuid');

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

function _getRequestOptionsForLogEvent(token, body) {
    const myHeaders = new Headers();
    myHeaders.append('Authorization', token);
    myHeaders.append('Content-Type', 'application/json');

    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: body,
        redirect: 'follow',
    };
    return requestOptions;
}

async function _apiCall(apiUrl, requestOptions) {
    const result = fetch(apiUrl, requestOptions).then((response) => response.text());
    return result;
}


module.exports = {
    initialize,
    trackEvent: logEvent,
};
