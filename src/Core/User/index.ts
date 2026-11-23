/* eslint-disable @typescript-eslint/no-explicit-any */
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';
import { SyncStatePolicy, UserStateManager } from './State';
import { EventLogger, NotiflyInternalEvent } from '../Event';
import { NotiflyStorage, NotiflyStorageKeys } from '../Storage';
import { SetUserIdOptions } from '../Interfaces/Options';
import { SdkStateManager, SdkType } from '../SdkState';
import { KmpUserIdTransitionPolicy } from '../KmpCore';
import { generateNotiflyUserId } from '../Utils';

export class UserIdentityManager {
    private static _lastUserPropertiesSentAt = -Infinity;
    private static _lastUserPropertiesRevision: number | null = null;
    private static readonly DEFAULT_SET_USER_ID_OPTIONS = { onlyIfChanged: false };

    static async setUserId(userId?: string | null, options?: SetUserIdOptions): Promise<void> {
        const onlyIfChanged = options?.onlyIfChanged ?? this.DEFAULT_SET_USER_ID_OPTIONS.onlyIfChanged;
        if (onlyIfChanged && this._areUserIdsIdentical(userId, await this.getUserId())) return;
        if (!userId?.trim()) await this.removeUserId();
        else await this.setUserProperties({ external_user_id: userId });
    }

    static async getUserId(): Promise<string | null> {
        return NotiflyStorage.getItem(NotiflyStorageKeys.EXTERNAL_USER_ID);
    }

    static async getUserProperties(): Promise<Record<string, any> | null> {
        await UserStateManager.ensureCurrentIdentity();
        return UserStateManager.state.userData.user_properties || null;
    }

    static async setUserProperties(params: Record<string, any>) {
        const externalUserId = params.external_user_id?.toString();
        if (externalUserId) {
            const previous = await NotiflyStorage.getIdentitySnapshot();
            const { projectId, deviceId, externalUserId: previousExternalUserId } = previous.values;
            if (this._areUserIdsIdentical(externalUserId, previousExternalUserId)) return;
            const updated = await NotiflyStorage.compareAndSetExternalUserId(externalUserId, previous.revision);
            this._lastUserPropertiesSentAt = -Infinity;
            const transitionParams = {
                ...params,
                previous_notifly_user_id: generateNotiflyUserId(projectId, previousExternalUserId, deviceId),
                previous_external_user_id: previousExternalUserId,
            };
            // Keep the committed transition's identity even if another tab changes storage before transport.
            await EventLogger.logEvent(
                NotiflyInternalEvent.SET_USER_PROPERTIES,
                transitionParams,
                null,
                true,
                undefined,
                updated
            );
            await UserStateManager.refresh(
                previousExternalUserId ? SyncStatePolicy.OVERWRITE : SyncStatePolicy.MERGE,
                'identity',
                { from: previous.revision, to: updated.revision }
            );
            return;
        }

        const identity = await UserStateManager.ensureCurrentIdentity();
        if (this._lastUserPropertiesRevision !== identity.revision) {
            this._lastUserPropertiesSentAt = -Infinity;
            this._lastUserPropertiesRevision = identity.revision;
        }
        const existing = UserStateManager.state.userData.user_properties || null;
        const unchanged =
            existing &&
            Object.keys(params).every(
                (key) => Object.prototype.hasOwnProperty.call(existing, key) && isEqual(existing[key], params[key])
            );
        const elapsed = Date.now() - this._lastUserPropertiesSentAt;
        if (unchanged && elapsed >= 0 && elapsed < 5000) return;

        if (SdkStateManager.type === SdkType.JS_CAFE24) {
            const diff: Record<string, any> = {};
            Object.keys(params).forEach((key) => {
                if (!isEqual((existing || {})[key], params[key])) diff[key] = params[key];
            });
            if (!isEmpty(diff)) {
                UserStateManager.updateUserProperties(diff);
                await EventLogger.logEvent(
                    NotiflyInternalEvent.SET_USER_PROPERTIES,
                    diff,
                    null,
                    true,
                    undefined,
                    identity
                );
            }
        } else {
            UserStateManager.updateUserProperties(params);
            this._lastUserPropertiesSentAt = Date.now();
            await EventLogger.logEvent(
                NotiflyInternalEvent.SET_USER_PROPERTIES,
                params,
                null,
                true,
                undefined,
                identity
            );
        }
    }

    static async removeUserId(): Promise<void> {
        const previous = await NotiflyStorage.getIdentitySnapshot();
        const updated = previous.values.externalUserId
            ? await NotiflyStorage.compareAndSetExternalUserId(null, previous.revision)
            : previous;
        this._lastUserPropertiesSentAt = -Infinity;
        if (previous.values.externalUserId) {
            await UserStateManager.refresh(SyncStatePolicy.OVERWRITE, 'identity', {
                from: previous.revision,
                to: updated.revision,
            });
        } else {
            await UserStateManager.ensureCurrentIdentity();
        }
        await EventLogger.logEvent(NotiflyInternalEvent.REMOVE_EXTERNAL_USER_ID, {}, null, true, undefined, updated);
        const current = await NotiflyStorage.getIdentitySnapshot();
        if (current.revision === updated.revision && UserStateManager.identityRevision === updated.revision) {
            UserStateManager.clearAll();
        }
    }

    private static _areUserIdsIdentical(
        userId: string | null | undefined,
        anotherUserId: string | null | undefined
    ): boolean {
        return !KmpUserIdTransitionPolicy.evaluate(userId || null, anotherUserId || null).changed;
    }
}
