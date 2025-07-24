/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Campaign, ReEligibleCondition } from '../Interfaces/Campaign';
import type { EventIntermediateCounts, UserData } from '../Interfaces/User';

import { NotiflyStorage, NotiflyStorageKeys } from '../Storage';
import { NotiflyAPI } from '../API';
import {
    getCurrentDefaultUserData,
    mergeEventCounts,
    mergeObjects,
    reEligibleConditionUnitToSeconds,
    sanitizeRandomBucketNumber,
} from './Utils';

import {
    getKSTCalendarDateString,
    isValidCampaignData,
    isValidEventIntermediateCounts,
    isValidUserState,
} from './Utils';

export enum SyncStatePolicy {
    OVERWRITE,
    MERGE,
}

type SyncStateOptions = {
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

    static async saveState() {
        try {
            await NotiflyStorage.setItem(NotiflyStorageKeys.NOTIFLY_STATE, JSON.stringify(this.state));
        } catch (e) {
            console.warn(
                '[Notifly] Failed to save state to IndexedDB. This is mostly due to the sudden browser shutdown.',
                e
            );
        }
    }

    static async sync(options: SyncStateOptions): Promise<void> {
        await this._syncState(options);
    }

    static async refresh(policy: SyncStatePolicy = SyncStatePolicy.OVERWRITE) {
        return this._syncState({
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
        segmentationEventParamKeys?: string[] | null
    ) {
        const formattedDate = getKSTCalendarDateString();
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

        this.saveState();
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

        this.saveState();
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

        this.saveState();
    }

    private static _clearCampaignHiddenUntilData() {
        this.userData.campaign_hidden_until = {};
    }

    static clearAll() {
        this._clearEventCounts();
        this._clearUserProperties();
        this._clearCampaignHiddenUntilData();

        this.saveState();
    }

    private static async _syncState(options: SyncStateOptions): Promise<void> {
        await this.updateExternalUserId();

        const useStorageIfAvailable = options.useStorageIfAvailable ?? true;
        const policy = options.policy ?? SyncStatePolicy.OVERWRITE;

        if (useStorageIfAvailable) {
            // Get state from storage, if available
            const storedState = await NotiflyStorage.getItem(NotiflyStorageKeys.NOTIFLY_STATE);
            try {
                const parsedStateJson = storedState ? JSON.parse(storedState) : null;
                if (parsedStateJson && isValidUserState(parsedStateJson)) {
                    const parsedState = parsedStateJson as {
                        eventIntermediateCounts: EventIntermediateCounts[];
                        inWebMessageCampaigns: Campaign[];
                        userData: UserData;
                    };

                    this.eventIntermediateCounts = parsedState.eventIntermediateCounts;
                    this.inWebMessageCampaigns = parsedState.inWebMessageCampaigns;
                    this._overwriteUserData(parsedState.userData);

                    await this.saveState();
                    return;
                }
                console.warn('[Notifly] State from storage might have been corrupted. Ignoring state from storage.');
            } catch (error) {
                console.warn('[Notifly] State from storage might have been corrupted. Ignoring state from storage.');
            }
        }

        const [projectId, notiflyDeviceId] = await NotiflyStorage.getItems([
            NotiflyStorageKeys.PROJECT_ID,
            NotiflyStorageKeys.NOTIFLY_DEVICE_ID,
        ]);
        const notiflyUserId = await NotiflyStorage.getNotiflyUserId();

        if (!projectId || !notiflyDeviceId || !notiflyUserId) {
            throw new Error('Project ID, device ID, Notifly User ID should be set before logging an event.');
        }

        const data = await NotiflyAPI.call(
            `https://api.notifly.tech/user-state/${projectId}/${notiflyUserId}?${
                notiflyDeviceId ? `deviceId=${notiflyDeviceId}` : ''
            }`,
            'GET'
        );

        // DB의 디바이스-유저 매핑 정보와 SDK에 저장된 유저 정보가 다른 경우
        // DB를 Source of Truth로 하여 SDK의 external_user_id를 DB 값으로 변경
        if (options.handleExternalUserIdMismatch) {
            const userData = data.userData || {};
            const deviceExternalUserId = userData['device_external_user_id'];
            const sdkExternalUserId = await NotiflyStorage.getItem(NotiflyStorageKeys.EXTERNAL_USER_ID);

            if (this.shouldHandleExternalUserIdMismatch(sdkExternalUserId, deviceExternalUserId)) {
                // SDK의 external_user_id를 DB 값으로 변경
                await NotiflyStorage.setItem(NotiflyStorageKeys.EXTERNAL_USER_ID, deviceExternalUserId);
                await this._syncState({
                    ...options,
                    policy: SyncStatePolicy.OVERWRITE,
                    handleExternalUserIdMismatch: false,
                });
                return;
            }
        }

        this._updateStatesBasedOnPolicy(data, policy);
        await this.saveState();
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
