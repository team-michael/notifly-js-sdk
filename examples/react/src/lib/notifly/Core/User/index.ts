/* eslint-disable @typescript-eslint/no-explicit-any */
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';

import { SyncStatePolicy, UserStateManager } from './State';
import { EventLogger } from '../Event';
import { NotiflyStorage, NotiflyStorageKeys } from '../Storage';

import { storeUserIdentity } from '../Utils';

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
export class UserIdentityManager {
    static async setUserId(userId?: string | null | undefined) {
        if (!userId) {
            await this.removeUserId();
        } else {
            await this.setUserProperties({
                external_user_id: userId,
            });
        }
    }

    static async getUserId(): Promise<string | null> {
        return NotiflyStorage.getItem(NotiflyStorageKeys.EXTERNAL_USER_ID);
    }

    static async getUserProperties(): Promise<Record<string, any> | null> {
        return UserStateManager.state.userData.user_properties || null;
    }

    static async setUserProperties(params: Record<string, any>) {
        const externalUserId = params.external_user_id?.toString();

        if (externalUserId) {
            const [projectId, previousNotiflyUserId, previousExternalUserId] = await NotiflyStorage.getItems([
                NotiflyStorageKeys.PROJECT_ID,
                NotiflyStorageKeys.NOTIFLY_USER_ID,
                NotiflyStorageKeys.EXTERNAL_USER_ID,
            ]);

            if (!projectId) {
                throw new Error('[Notifly] Project ID should be set before setting user properties.');
            }

            params.previous_notifly_user_id = previousNotiflyUserId;
            params.previous_external_user_id = previousExternalUserId;

            if (!this._areUserIdsIdentical(externalUserId, previousExternalUserId)) {
                // Caution: order matters here!
                await NotiflyStorage.setItem(NotiflyStorageKeys.EXTERNAL_USER_ID, externalUserId);
                await storeUserIdentity();
                await EventLogger.logEvent('set_user_properties', params, null, true);

                const policy = previousExternalUserId
                    ? SyncStatePolicy.OVERWRITE // A -> B
                    : SyncStatePolicy.MERGE; // null -> A
                await UserStateManager.refresh(policy);
            } else {
                // Even if the user ID is the same, we opted to log the event to ensure for logging purposes that the user ID is set.
                // See https://www.notion.so/greyboxhq/User-Set-User-Id-e3ab764388724a878fc56d8e54c95bc8
                await EventLogger.logEvent('set_user_properties', params, null, true);
            }
        } else {
            // Update local state
            const diff: Record<string, any> = {};
            const previousUserProperties = (await this.getUserProperties()) || {};

            Object.keys(params).forEach((key) => {
                if (!isEqual(previousUserProperties[key], params[key])) {
                    diff[key] = params[key];
                }
            });

            if (!isEmpty(diff)) {
                UserStateManager.updateUserProperties(diff);
                await EventLogger.logEvent('set_user_properties', diff, null, true);
            }
        }
    }

    static async removeUserId(): Promise<void> {
        const previousExternalUserId = await NotiflyStorage.getItem(NotiflyStorageKeys.EXTERNAL_USER_ID);
        if (previousExternalUserId) {
            // A -> null
            await this._cleanUserIdInLocalStorage();
            await storeUserIdentity();
            await UserStateManager.refresh(); // Should refresh data due to the random bucket number
        }
        await EventLogger.logEvent('remove_external_user_id', {}, null, true);
        UserStateManager.clearAll();
    }

    private static async _cleanUserIdInLocalStorage() {
        await NotiflyStorage.removeItem(NotiflyStorageKeys.EXTERNAL_USER_ID);
    }

    private static _areUserIdsIdentical(
        userId: string | null | undefined,
        anotherUserId: string | null | undefined
    ): boolean {
        return (!userId && !anotherUserId) || userId === anotherUserId;
    }
}
