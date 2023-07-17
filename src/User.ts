import { WebMessageManager } from './WebMessages/Manager';
import { logEvent } from './Event';
import { generateNotiflyUserId } from './Utils';
import { NotiflyStorage, NotiflyStorageKeys } from './Storage';

const SYNC_TIMEOUT_AFTER_USER_ID_CHANGED = 5000;

/**
 * Sets or removes user ID for the current user.
 *
 * @async
 * @param {string | null | undefined} params - A nullable, optional string containing the user ID to set.
 * @returns {Promise<void>}
 * @summary If the user ID is null or undefined, the user ID will be removed. Otherwise, the user ID will be set to the provided value.
 *
 * @example
 * await setUserId('myUserID') // Sets the user ID to 'myUserID'
 * await setUserId(null) // Removes the user ID
 * await setUserId() // Removes the user ID
 */
async function setUserId(userID?: string | null | undefined) {
    try {
        if (!userID) {
            await removeUserId();
        } else {
            await setUserProperties({
                external_user_id: userID,
            });
        }
    } catch (err) {
        console.warn('[Notifly] setUserId failed');
    } finally {
        setTimeout(WebMessageManager.refreshState.bind(WebMessageManager), SYNC_TIMEOUT_AFTER_USER_ID_CHANGED);
    }
}

/**
 * Sets user properties for the current user.
 *
 * @async
 * @param {Object} params - An object containing the user properties to set.
 * @returns {Promise<void>}
 *
 * @example
 * await setUserProperties({ external_user_id: 'myUserID' });
 */
async function setUserProperties(params: Record<string, any>): Promise<void> {
    try {
        if (params.external_user_id) {
            const [projectID, previousNotiflyUserID, previousExternalUserID] = await NotiflyStorage.getItems([
                NotiflyStorageKeys.PROJECT_ID,
                NotiflyStorageKeys.NOTIFLY_USER_ID,
                NotiflyStorageKeys.EXTERNAL_USER_ID,
            ]);

            if (!projectID) {
                console.error('[Notifly] Project ID should be set before setting user properties.');
                return;
            }

            params['previous_notifly_user_id'] = previousNotiflyUserID;
            params['previous_external_user_id'] = previousExternalUserID;

            const notiflyUserID = await generateNotiflyUserId(projectID, params.external_user_id);
            await NotiflyStorage.setItems({
                __notiflyUserID: notiflyUserID,
                __notiflyExternalUserID: params.external_user_id,
            });
        }

        // Update local state
        WebMessageManager.updateUserData(params);

        return await logEvent('set_user_properties', params, null, true);
    } catch (err) {
        console.warn('[Notifly] Failed to set user properties:', err);
    }
}

/**
 * Removes the external user ID and Notifly user ID from localForage.
 *
 * @async
 * @returns {Promise<void>}
 *
 * @example
 * await removeUserId();
 */
async function removeUserId(): Promise<void> {
    try {
        await _cleanUserIDInLocalForage();
        await logEvent('remove_external_user_id', {}, null, true);
        return;
    } catch (err) {
        console.warn('[Notifly] Failed to remove userID');
    }
}

/**
 * Permanently deletes the current user from Notifly.
 *
 * @async
 * @returns {Promise<void>}
 *
 * @example
 * await deleteUser();
 */
async function deleteUser(): Promise<void> {
    try {
        await logEvent('delete_user', {}, null, true);
        await _cleanUserIDInLocalForage();
        await logEvent('remove_external_user_id', {}, null, true);
        await WebMessageManager.refreshState();
        return;
    } catch (err) {
        console.warn('[Notifly] Failed to delete user');
    }
}

async function _cleanUserIDInLocalForage() {
    await NotiflyStorage.removeItems([NotiflyStorageKeys.NOTIFLY_USER_ID, NotiflyStorageKeys.EXTERNAL_USER_ID]);
}

export { setUserProperties, setUserId, deleteUser };
