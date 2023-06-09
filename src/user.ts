import * as localForage from 'localforage';
import { logEvent } from './logEvent';
import { generateNotiflyUserID } from './utils';
import { refreshState, syncState, updateUserData } from './state';

async function setUserId(userID?: string | null | undefined) {
    if (!userID) {
        await removeUserId();
        refreshState();
        return;
    }
    try {
        await setUserProperties({
            external_user_id: userID,
        });
        const [projectID, notiflyUserID] = await Promise.all([
            localForage.getItem<string>('__notiflyProjectID'),
            localForage.getItem<string>('__notiflyUserID'),
        ]);
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
            const [projectID, previousNotiflyUserID, previousExternalUserID] = await Promise.all([
                localForage.getItem<string>('__notiflyProjectID'),
                localForage.getItem<string>('__notiflyUserID'),
                localForage.getItem<string>('__notiflyExternalUserID'),
            ]);

            if (!projectID) {
                console.error('[Notifly] Project ID should be set before setting user properties.');
                return;
            }

            params['previous_notifly_user_id'] = previousNotiflyUserID;
            params['previous_external_user_id'] = previousExternalUserID;

            const notiflyUserID = await generateNotiflyUserID(projectID, params.external_user_id);

            await Promise.all([
                localForage.setItem('__notiflyUserID', notiflyUserID),
                localForage.setItem('__notiflyExternalUserID', params.external_user_id),
            ]);
        }

        // Update local state
        updateUserData(params);

        return await logEvent('set_user_properties', params, null, true);
    } catch (err) {
        console.warn('[Notifly] Failed to set user properties:', err);
    }
}

/**
 * Removes the external user ID and Notifly user ID from localForage.
 *
 * @async
 * @returns {Promise<void>} A promise that resolves when the user IDs have been removed, or rejects with an error.
 *
 * @example
 * await removeUserId();
 */
async function removeUserId(): Promise<void> {
    try {
        await Promise.all([
            localForage.removeItem('__notiflyExternalUserID'),
            localForage.removeItem('__notiflyUserID'),
        ]);
        return await logEvent('remove_external_user_id', {}, null, true);
    } catch (err) {
        console.warn('[Notifly] Failed to remove userID');
    }
}

export { setUserProperties, removeUserId, setUserId };
