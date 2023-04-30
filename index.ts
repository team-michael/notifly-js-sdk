// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NAMESPACE'... Remove this comment to see the full error message
const { NAMESPACE } = require('./src/constants');
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'logEvent'.
const { logEvent } = require('./src/logEvent');
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'saveCognit... Remove this comment to see the full error message
const { saveCognitoIdToken } = require('./src/auth');
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'v5'.
const { v5 } = require('uuid');
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'sessionSta... Remove this comment to see the full error message
const { sessionStart, getNotiflyUserID } = require('./src/logEvent');

async function initialize(projectID: any, userName: any, password: any, deviceToken: any) {
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

async function setUserId(userID: any) {
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

function _saveNotiflyData(data: any) {
    // @ts-expect-error TS(2550): Property 'entries' does not exist on type 'ObjectC... Remove this comment to see the full error message
    for (const [key, val] of Object.entries(data)) {
        localStorage.setItem(key, val);
    }
}

/**
 * Sets user properties for the current user.
 *
 * @async
 * @param {Object} params - An object containing the user properties to set.
 * @returns {Promise<void>} A promise that resolves when the user properties have been set, or rejects with an error.
 *
 * @example
 * await setUserProperties({ external_user_id: 'myUserID' });
 */
async function setUserProperties(params: any) {
    try {
        if (params.external_user_id) {
            /* const [previousNotiflyUserID, previousExternalUserID] = await Promise.all([
                getNotiflyUserId(),
                localStorage.getItem('__notiflyExternalUserID'),
            ]); */
            localStorage.setItem('__notiflyExternalUserID', params.external_user_id);
            localStorage.removeItem('__notiflyUserId');
            /* params['previous_notifly_user_id'] = previousNotiflyUserID;
            params['previous_external_user_id'] = previousExternalUserID; */
        }
        return await logEvent('set_user_properties', params, null, true);
    } catch (err) {
        console.warn('[Notifly] Failed to set user properties:', err);
    }
}

/**
 * Removes the external user ID and Notifly user ID from storage.
 *
 * @async
 * @returns {Promise<void>} A promise that resolves when the user IDs have been removed, or rejects with an error.
 *
 * @example
 * await removeUserId();
 */
async function removeUserId() {
    try {
        localStorage.removeItem('__notiflyExternalUserID');
        localStorage.removeItem('__notiflyUserId');
        return await logEvent('remove_external_user_id', {}, null, true);
    } catch (err) {
        console.warn('[Notifly] Failed to remove userID');
    }
}

// @ts-expect-error TS(2580): Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = {
    initialize,
    trackEvent: logEvent,
    setUserProperties,
    removeUserId,
    setUserId,
    getNotiflyUserID,
};
