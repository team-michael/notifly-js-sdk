/* eslint-disable @typescript-eslint/no-explicit-any */
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';

import { SdkState, SdkStateManager } from '../SdkState';
import { UserStateManager } from './State';
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
        if (await this._isIdenticalUserId(userId)) {
            this._softRefresh();
            return;
        } else {
            if (!userId) {
                await this.removeUserId();
            } else {
                await this.setUserProperties({
                    external_user_id: userId,
                });
            }
        }
    }

    static async getUserId(): Promise<string | null> {
        return NotiflyStorage.getItem(NotiflyStorageKeys.EXTERNAL_USER_ID);
    }

    static async setUserProperties(params: Record<string, any>) {
        if (params.external_user_id) {
            const externalUserId = params.external_user_id;

            const [projectID, previousNotiflyUserID, previousExternalUserID] = await NotiflyStorage.getItems([
                NotiflyStorageKeys.PROJECT_ID,
                NotiflyStorageKeys.NOTIFLY_USER_ID,
                NotiflyStorageKeys.EXTERNAL_USER_ID,
            ]);

            if (!projectID || !previousNotiflyUserID) {
                throw new Error('[Notifly] Project ID should be set before setting user properties.');
            }

            params['previous_notifly_user_id'] = previousNotiflyUserID;
            params['previous_external_user_id'] = previousExternalUserID;

            await NotiflyStorage.setItem(NotiflyStorageKeys.EXTERNAL_USER_ID, externalUserId);
            await storeUserIdentity();

            await EventLogger.logEvent('set_user_properties', params, null, true);
            await UserStateManager.refresh();
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
                UserStateManager.updateUserData(diff);
                await EventLogger.logEvent('set_user_properties', diff, null, true);
            }
        }
    }

    static async getUserProperties(): Promise<Record<string, any> | null> {
        return UserStateManager.state.userData.user_properties || null;
    }

    static async removeUserId(): Promise<void> {
        const previousExternalUserId = await NotiflyStorage.getItem(NotiflyStorageKeys.EXTERNAL_USER_ID);
        if (!previousExternalUserId) {
            this._softRefresh();
            return;
        }
        await this._cleanUserIdInLocalStorage();
        await storeUserIdentity();
        await EventLogger.logEvent('remove_external_user_id', {}, null, true);
        await UserStateManager.refresh();
    }

    static async deleteUser(): Promise<void> {
        await EventLogger.logEvent('delete_user', {}, null, true);
        await this._cleanUserIdInLocalStorage();
        await storeUserIdentity();
        await EventLogger.logEvent('remove_external_user_id', {}, null, true);
        return await UserStateManager.refresh();
    }

    private static async _cleanUserIdInLocalStorage() {
        await NotiflyStorage.removeItem(NotiflyStorageKeys.EXTERNAL_USER_ID);
    }

    private static async _isIdenticalUserId(userId: string | null | undefined): Promise<boolean> {
        const previousExternalUserId = await NotiflyStorage.getItem(NotiflyStorageKeys.EXTERNAL_USER_ID);
        return previousExternalUserId === userId || (!previousExternalUserId && !userId);
    }

    private static async _softRefresh() {
        SdkStateManager.state = SdkState.REFRESHING;
        SdkStateManager.state = SdkState.READY;
    }
}
