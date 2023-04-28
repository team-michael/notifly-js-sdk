const { v5 } = require('uuid');
const { NAMESPACE } = require('./constants');
const { logEvent } = require('./logEvent');

function getNotiflyUserID(deviceToken) {
    const externalUserID = localStorage.getItem('__notiflyExternalUserID');
    if (externalUserID) {
        return v5(externalUserID, NAMESPACE.REGISTERED_USERID);
    }
    return v5(deviceToken, NAMESPACE.UNREGISTERED_USERID);
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
async function setUserProperties(params) {
    try {
        if (params.external_user_id) {

            /* const [previousNotiflyUserID, previousExternalUserID] = await Promise.all([
                getNotiflyUserId(),
                localStorage.getItem('__notiflyExternalUserId'),
            ]); */
            await Promise.all([
                localStorage.setItem('__notiflyExternalUserId', params.external_user_id),
                localStorage.removeItem('__notiflyUserId'),
            ]);
            /* params['previous_notifly_user_id'] = previousNotiflyUserID;
            params['previous_external_user_id'] = previousExternalUserID; */
        }
        return await logEvent('set_user_properties', params, null, true);
    } catch (err) {
        console.warn('[Notifly] Failed to set user properties');
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
        await Promise.all([
            localStorage.removeItem('__notiflyExternalUserId'),
            localStorage.removeItem('__notiflyUserId'),
        ]);
        return await logEvent('remove_external_user_id', {}, null, true);
    } catch (err) {
        console.warn('[Notifly] Failed to remove userID');
    }
}

module.exports = {
    getNotiflyUserID,
    setUserProperties,
    removeUserId,
};
