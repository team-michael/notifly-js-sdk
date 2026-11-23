/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Campaign, ReEligibleCondition } from '../Interfaces/Campaign';
import type { EventIntermediateCounts, UserData } from '../Interfaces/User';

import { NotiflyStorage, NotiflyStorageKeys } from '../Storage';
import { NotiflyAPI } from '../API';
import { generateNotiflyUserId } from '../Utils';
import { beginPerformance } from '../Diagnostics';
import { ProtectedSnapshot, ProtectedStorageError } from '../Storage/ProtectedStorageTypes';
import {
    getCurrentDefaultUserData,
    mergeEventCounts,
    mergeObjects,
    reEligibleConditionUnitToSeconds,
    sanitizeRandomBucketNumber,
} from './Utils';

import { getKSTCalendarDateString, isValidCampaignData, isValidEventIntermediateCounts } from './Utils';

export enum SyncStatePolicy {
    OVERWRITE,
    MERGE,
}

export type SyncReason = 'initial' | 'session' | 'identity' | 'sse' | 'refresh';
type SyncStateOptions = {
    reason?: SyncReason;
    transition?: { from: number; to: number };
    policy?: SyncStatePolicy;
    useStorageIfAvailable?: boolean;
    handleExternalUserIdMismatch?: boolean;
};

export class UserStateManager {
    static eventIntermediateCounts: EventIntermediateCounts[] = [];
    static inWebMessageCampaigns: Campaign[] = [];
    static userData: UserData = getCurrentDefaultUserData();

    static get state() {
        return {
            eventIntermediateCounts: this.eventIntermediateCounts,
            inWebMessageCampaigns: this.inWebMessageCampaigns,
            userData: this.userData,
        };
    }

    private static syncQueue: Promise<void> = Promise.resolve();
    static identityRevision: number | null = null;

    static async sync(options: SyncStateOptions): Promise<void> {
        const operation = this.syncQueue.catch(() => undefined).then(() => this._syncState(options));
        this.syncQueue = operation;
        return operation;
    }

    static async ensureCurrentIdentity(): Promise<ProtectedSnapshot> {
        let snapshot = await NotiflyStorage.getIdentitySnapshot();
        if (this.identityRevision !== snapshot.revision) {
            this.invalidateIdentity();
            await this.refresh(SyncStatePolicy.OVERWRITE, 'identity');
            snapshot = await NotiflyStorage.getIdentitySnapshot();
            if (snapshot.revision !== this.identityRevision) throw new Error('[Notifly] Identity is changing.');
        }
        return snapshot;
    }

    static async refresh(
        policy: SyncStatePolicy = SyncStatePolicy.OVERWRITE,
        reason: SyncReason = 'refresh',
        transition?: { from: number; to: number }
    ) {
        return this.sync({
            transition,
            reason,
            policy,
            useStorageIfAvailable: false,
        });
    }

    static async updateExternalUserId() {
        this.userData.external_user_id = await NotiflyStorage.getItem(NotiflyStorageKeys.EXTERNAL_USER_ID);
    }

    static updateAndGetCampaignHiddenUntilDataAccordingToReEligibleCondition(
        campaignId: string,
        reEligibleCondition: ReEligibleCondition
    ) {
        if (!this.userData.campaign_hidden_until) {
            this.userData.campaign_hidden_until = {};
        }
        const previousLogs = this.getMessageLogs(campaignId);
        const now = Math.floor(Date.now() / 1000);
        const newLogs = [...(previousLogs ?? []), now];
        const campaignHiddenUntilData: Record<string, any> = {};

        if (newLogs.length >= (reEligibleCondition.max_count ?? 1)) {
            const hiddenDuration =
                reEligibleConditionUnitToSeconds[reEligibleCondition.unit] * reEligibleCondition.value;
            campaignHiddenUntilData[`${campaignId}`] = now + hiddenDuration;
        }
        campaignHiddenUntilData[`${campaignId}_message_logs`] = [...(previousLogs ?? []), now];

        this.updateCampaignHiddenUntilData(campaignHiddenUntilData);
        return campaignHiddenUntilData;
    }

    static updateEventCounts(
        eventName: string,
        eventParams: Record<string, any>,
        segmentationEventParamKeys?: string[] | null,
        occurredAtMicros?: number
    ) {
        const formattedDate = getKSTCalendarDateString(
            0,
            occurredAtMicros === undefined ? Date.now() : occurredAtMicros / 1000
        );
        const keyField = segmentationEventParamKeys ? segmentationEventParamKeys[0] : null;
        const valueField = keyField ? eventParams[keyField] || null : null;

        const predicate = (row: EventIntermediateCounts) => {
            if (keyField && valueField) {
                return row.dt === formattedDate && row.name === eventName && row.event_params[keyField] === valueField;
            } else {
                return row.dt === formattedDate && row.name === eventName;
            }
        };
        const existingRow = this.eventIntermediateCounts.find(predicate);
        if (existingRow) {
            // If an existing row is found, increase the count by 1
            existingRow.count += 1;
        } else {
            // If no existing row is found, create a new entry
            this.eventIntermediateCounts.push({
                dt: formattedDate,
                name: eventName,
                count: 1,
                event_params: eventParams || {},
            });
        }
    }

    private static _clearEventCounts() {
        this.eventIntermediateCounts = [];
    }

    static updateUserProperties(params: Record<string, any>) {
        if (!this.userData.user_properties) {
            this.userData.user_properties = {};
        }
        Object.keys(params).forEach((key) => {
            this.userData.user_properties && (this.userData.user_properties[key] = params[key]);
        });
    }

    private static _clearUserProperties() {
        this.userData.user_properties = {};
    }

    static updateCampaignHiddenUntilData(campaignHiddenUntilData: Record<string, any>) {
        if (!this.userData.campaign_hidden_until) {
            this.userData.campaign_hidden_until = {};
        }
        this.userData.campaign_hidden_until = {
            ...this.userData.campaign_hidden_until,
            ...campaignHiddenUntilData,
        };
    }

    private static _clearCampaignHiddenUntilData() {
        this.userData.campaign_hidden_until = {};
    }

    static invalidateIdentity() {
        this.inWebMessageCampaigns = [];
        this.identityRevision = null;
        this.clearAll();
    }

    static clearAll() {
        this._clearEventCounts();
        this._clearUserProperties();
        this._clearCampaignHiddenUntilData();
    }

    private static async _syncState(options: SyncStateOptions, attempt = 0): Promise<void> {
        if (attempt >= 3) throw new Error('[Notifly] Identity changed repeatedly during synchronization.');
        const snapshot = await NotiflyStorage.getIdentitySnapshot();
        const { projectId, deviceId, externalUserId } = snapshot.values;
        const notiflyUserId = generateNotiflyUserId(projectId, externalUserId, deviceId);
        const end = beginPerformance('user-state.' + (attempt ? 'correction' : options.reason ?? 'refresh'));
        let data: any;
        try {
            data = await NotiflyAPI.call(
                'https://api.notifly.tech/user-state/' +
                    projectId +
                    '/' +
                    notiflyUserId +
                    '?channel=in-web-message&deviceId=' +
                    encodeURIComponent(deviceId),
                'GET'
            );
            end(true);
        } catch (error) {
            end(false);
            throw error;
        }
        const current = await NotiflyStorage.getIdentitySnapshot();
        if (current.revision !== snapshot.revision) {
            this.invalidateIdentity();
            return this._syncState(
                { ...options, policy: SyncStatePolicy.OVERWRITE, handleExternalUserIdMismatch: false },
                attempt + 1
            );
        }
        const deviceExternalUserId = data.userData?.device_external_user_id;
        if (
            options.handleExternalUserIdMismatch &&
            this.shouldHandleExternalUserIdMismatch(externalUserId, deviceExternalUserId)
        ) {
            try {
                await NotiflyStorage.compareAndSetExternalUserId(deviceExternalUserId, snapshot.revision);
            } catch (error) {
                if (!(error instanceof ProtectedStorageError) || error.code !== 'REVISION_CONFLICT') throw error;
                this.invalidateIdentity();
            }
            return this._syncState(
                { ...options, policy: SyncStatePolicy.OVERWRITE, handleExternalUserIdMismatch: false },
                attempt + 1
            );
        }
        this.userData.external_user_id = externalUserId;
        const transitionChanged =
            options.transition &&
            (options.transition.to !== snapshot.revision || options.transition.from !== this.identityRevision);
        this._updateStatesBasedOnPolicy(
            data,
            transitionChanged ? SyncStatePolicy.OVERWRITE : options.policy ?? SyncStatePolicy.OVERWRITE
        );
        this.identityRevision = snapshot.revision;
    }

    private static shouldHandleExternalUserIdMismatch(
        sdkExternalUserId?: string | null,
        deviceExternalUserId?: string | null
    ): boolean {
        // SDK가 null인 경우는 앱 재설치 등으로 허용되는 상황이므로 핸들링하지 않음
        if (sdkExternalUserId == null) {
            return false;
        }
        // DB가 null인 경우는 다양한 원인(쿼리 에러, 디바이스 미저장 등)으로 인해 실제 값이 null이 아닐 가능성이 있어 핸들링하지 않음
        if (deviceExternalUserId == null) {
            return false;
        }
        // 두 값이 같은 경우는 정상적인 상황
        if (sdkExternalUserId === deviceExternalUserId) {
            return false;
        }
        return true;
    }

    private static _updateStatesBasedOnPolicy(data: any, policy: SyncStatePolicy) {
        const incomingCampaignData: Campaign[] = isValidCampaignData(data.campaignData)
            ? data.campaignData.filter((c: Campaign) => c.channel === 'in-web-message')
            : [];
        const incomingEventIntermediateCountsData: EventIntermediateCounts[] = isValidEventIntermediateCounts(
            data.eventIntermediateCountsData
        )
            ? data.eventIntermediateCountsData
            : [];

        switch (policy) {
            case SyncStatePolicy.OVERWRITE:
                this.inWebMessageCampaigns = incomingCampaignData;
                this.eventIntermediateCounts = incomingEventIntermediateCountsData;
                this._overwriteUserData(data.userData || {});
                break;
            case SyncStatePolicy.MERGE:
                // Should merge data
                this.inWebMessageCampaigns = incomingCampaignData;
                this.eventIntermediateCounts = mergeEventCounts(
                    this.eventIntermediateCounts,
                    incomingEventIntermediateCountsData
                );
                this._mergeUserData(data.userData || {});
                break;
            default:
                throw new Error(`Invalid policy: ${policy}`);
        }
    }

    // User data fields to be manipulated :
    // - user_properties
    // - campaign_hidden_until
    // - random_bucket_number
    // - updated_at
    private static _overwriteUserData(incoming: UserData) {
        this.userData.user_properties = incoming.user_properties || {};
        this.userData.campaign_hidden_until = incoming.campaign_hidden_until;
        this.userData.random_bucket_number = sanitizeRandomBucketNumber(incoming.random_bucket_number);
        this.userData.updated_at = incoming.updated_at || new Date().toISOString();
    }

    private static _mergeUserData(incoming: UserData) {
        this.userData.user_properties = mergeObjects(
            this.userData.user_properties || {},
            incoming.user_properties || {}
        );
        this.userData.campaign_hidden_until = mergeObjects(
            this.userData.campaign_hidden_until || {},
            incoming.campaign_hidden_until || {}
        );
        this.userData.random_bucket_number = sanitizeRandomBucketNumber(incoming.random_bucket_number);
        this.userData.updated_at = incoming.updated_at || new Date().toISOString();
    }

    static getMessageLogs(campaignId: string) {
        const logs = UserStateManager.userData.campaign_hidden_until?.[`${campaignId}_message_logs`];
        return logs;
    }
}
