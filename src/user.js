import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNotiflyUserId } from './utils';
import logEvent from './log_event';

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
export async function setUserProperties(params) {
    try {
        if (params.external_user_id) {
            const [previousNotiflyUserID, previousExternalUserID] = await Promise.all([
                getNotiflyUserId(),
                AsyncStorage.getItem('notiflyExternalUserId'),
            ]);
            await Promise.all([
                AsyncStorage.setItem('notiflyExternalUserId', params.external_user_id),
                AsyncStorage.removeItem('notiflyUserId'),
            ]);
            params['previous_notifly_user_id'] = previousNotiflyUserID;
            params['previous_external_user_id'] = previousExternalUserID;
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
export async function removeUserId() {
    try {
        await Promise.all([AsyncStorage.removeItem('notiflyExternalUserId'), AsyncStorage.removeItem('notiflyUserId')]);
        return await logEvent('remove_external_user_id', {}, null, true);
    } catch (err) {
        console.warn('[Notifly] Failed to remove userID');
    }
}
