import { logEvent } from './logEvent';
import { generateNotiflyUserID } from './utils';
import { syncState, updateUserData } from './state';

async function setUserId(userID?: string | null | undefined) {
    if (!userID) {
        await removeUserId();
        return;
    }
    try {
        await setUserProperties({
            external_user_id: userID,
        });
        const projectID = localStorage.getItem('__notiflyProjectID');
        const notiflyUserID = localStorage.getItem('__notiflyUserID');
        if (projectID && notiflyUserID) {
            await syncState(projectID, notiflyUserID);
        }
    } catch (err) {
        console.warn('[Notifly] setUserId failed');
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
async function setUserProperties(params: Record<string, any>): Promise<void> {
    try {
        if (params.external_user_id) {
            const [previousNotiflyUserID, previousExternalUserID] = await Promise.all([
                localStorage.getItem('__notiflyUserID'),
                localStorage.getItem('__notiflyExternalUserID'),
            ]);
            params['previous_notifly_user_id'] = previousNotiflyUserID;
            params['previous_external_user_id'] = previousExternalUserID;
            localStorage.setItem('__notiflyExternalUserID', params.external_user_id);
            localStorage.setItem('__notiflyUserID', generateNotiflyUserID(params.external_user_id) as string);
        }

        // Update local state
        updateUserData(params);

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
async function removeUserId(): Promise<void> {
    try {
        localStorage.removeItem('__notiflyExternalUserID');
        localStorage.removeItem('__notiflyUserID');
        return await logEvent('remove_external_user_id', {}, null, true);
    } catch (err) {
        console.warn('[Notifly] Failed to remove userID');
    }
}

export { setUserProperties, removeUserId, setUserId };
