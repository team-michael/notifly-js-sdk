/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Campaign, ReEligibleCondition } from '../Interfaces/Campaign';
import type { EventIntermediateCounts, UserData } from '../Interfaces/User';

import { SdkState, SdkStateManager } from '../SdkState';
import { NotiflyStorage, NotiflyStorageKeys } from '../Storage';
import { NotiflyAPI } from '../API';
import { mergeEventCounts, mergeObjects, reEligibleConditionUnitToSec, sanitizeRandomBucketNumber } from './Utils';

import {
    getKSTCalendarDateString,
    isValidCampaignData,
    isValidEventIntermediateCounts,
    isValidUserData,
    isValidUserState,
} from './Utils';

export enum SyncStatePolicy {
    OVERWRITE,
    MERGE,
}

type SyncStateOptions = {
    policy?: SyncStatePolicy;
    useStorageIfAvailable?: boolean;
};

export class UserStateManager {
    static eventIntermediateCounts: EventIntermediateCounts[] = [];
    static inWebMessageCampaigns: Campaign[] = [];
    static userData: UserData = {};

    static get state() {
        return {
            eventIntermediateCounts: this.eventIntermediateCounts,
            inWebMessageCampaigns: this.inWebMessageCampaigns,
            userData: this.userData,
        };
    }

    static initialize() {
        // Save user state before window is closed
        const handler = () => {
            if (document.visibilityState === 'hidden') {
                this.saveState();
            }
        };
        window.addEventListener('visibilitychange', handler.bind(this));
    }

    static async saveState() {
        await NotiflyStorage.setItem(NotiflyStorageKeys.NOTIFLY_USER_STATE, JSON.stringify(this.state));
    }

    static async sync(options: SyncStateOptions): Promise<void> {
        await this._syncState(options);
    }

    static async refresh(policy: SyncStatePolicy = SyncStatePolicy.OVERWRITE) {
        if (SdkStateManager.state !== SdkState.READY) {
            console.error('[Notifly] Cannot refresh state when the SDK is not ready. Ignoring refreshState call.');
            return;
        }
        SdkStateManager.state = SdkState.REFRESHING;
        try {
            await this._syncState({
                policy,
                useStorageIfAvailable: false,
            });
            SdkStateManager.state = SdkState.READY;
        } catch (error) {
            console.error('[Notifly] Failed to refresh state: ', error);
            SdkStateManager.state = SdkState.FAILED;
        }
    }

    static calculateCampaignHiddenUntilDataAccordingToReEligibleCondition(
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
            const hiddenDuration = reEligibleConditionUnitToSec[reEligibleCondition.unit] * reEligibleCondition.value;
            campaignHiddenUntilData[`${campaignId}`] = now + hiddenDuration;
        }
        campaignHiddenUntilData[`${campaignId}_message_logs`] = [...(previousLogs ?? []), now];

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
    }

    static clearEventCounts() {
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

    static clearUserProperties() {
        this.userData.user_properties = {};
    }

    static updateCampaignHiddenUntilData(campaignHiddenUntilData: Record<string, any>) {
        if (!UserStateManager.userData.campaign_hidden_until) {
            UserStateManager.userData.campaign_hidden_until = {};
        }
        UserStateManager.userData.campaign_hidden_until = {
            ...UserStateManager.userData.campaign_hidden_until,
            ...campaignHiddenUntilData,
        };
    }

    static clearCampaignHiddenUntilData() {
        UserStateManager.userData.campaign_hidden_until = {};
    }

    static clearAll() {
        this.clearEventCounts();
        this.clearUserProperties();
        this.clearCampaignHiddenUntilData();
    }

    private static async _syncState(options: SyncStateOptions): Promise<void> {
        const useStorageIfAvailable = options.useStorageIfAvailable ?? true;
        const policy = options.policy ?? SyncStatePolicy.OVERWRITE;

        if (useStorageIfAvailable) {
            // Get state from storage, if available
            const storedState = await NotiflyStorage.getItem(NotiflyStorageKeys.NOTIFLY_USER_STATE);
            try {
                const parsedStateJSON = storedState ? JSON.parse(storedState) : null;
                if (isValidUserState(parsedStateJSON)) {
                    const parsedState = parsedStateJSON as {
                        eventIntermediateCounts: EventIntermediateCounts[];
                        inWebMessageCampaigns: Campaign[];
                        userData: UserData;
                    };

                    this.eventIntermediateCounts = parsedState.eventIntermediateCounts;
                    this.inWebMessageCampaigns = parsedState.inWebMessageCampaigns;
                    this.userData = parsedState.userData;

                    await this._updateExternalUserId();

                    return;
                }
                console.warn('[Notifly] State from storage might have been corrupted. Ignoring state from storage.');
            } catch (error) {
                console.warn('[Notifly] State from storage might have been corrupted. Ignoring state from storage.');
            }
        }

        const [projectId, notiflyDeviceId, notiflyUserId] = await NotiflyStorage.getItems([
            NotiflyStorageKeys.PROJECT_ID,
            NotiflyStorageKeys.NOTIFLY_DEVICE_ID,
            NotiflyStorageKeys.NOTIFLY_USER_ID,
        ]);

        if (!projectId || !notiflyDeviceId || !notiflyUserId) {
            throw new Error('Project ID, device ID, Notifly User ID should be set before logging an event.');
        }

        const data = await NotiflyAPI.call(
            `https://api.notifly.tech/user-state/${projectId}/${notiflyUserId}?${
                notiflyDeviceId ? `deviceId=${notiflyDeviceId}` : ''
            }`,
            'GET'
        );

        this._writeStatesBasedOnPolicy(data, policy);

        await this._updateExternalUserId();
    }

    private static _writeStatesBasedOnPolicy(data: any, policy: SyncStatePolicy) {
        const incomingCampaignData: Campaign[] = isValidCampaignData(data.campaignData)
            ? data.campaignData.filter((c: Campaign) => c.channel === 'in-web-message')
            : [];
        const incomingEventIntermediateCountsData: EventIntermediateCounts[] = isValidEventIntermediateCounts(
            data.eventIntermediateCountsData
        )
            ? data.eventIntermediateCountsData
            : [];
        const incomingUserData: UserData = isValidUserData(data.userData) ? data.userData : {};

        this.userData.random_bucket_number = sanitizeRandomBucketNumber(incomingUserData.random_bucket_number);
        console.log('randombucket', this.userData.random_bucket_number);

        switch (policy) {
            case SyncStatePolicy.OVERWRITE:
                this.inWebMessageCampaigns = incomingCampaignData;
                this.eventIntermediateCounts = incomingEventIntermediateCountsData;
                this.userData = incomingUserData;
                break;
            case SyncStatePolicy.MERGE:
                // Should merge data
                this.inWebMessageCampaigns = incomingCampaignData;
                this.eventIntermediateCounts = mergeEventCounts(
                    this.eventIntermediateCounts,
                    incomingEventIntermediateCountsData
                );
                this.userData = {
                    ...this.userData,
                    user_properties: mergeObjects(
                        this.userData.user_properties || {},
                        incomingUserData.user_properties || {}
                    ),
                    campaign_hidden_until: mergeObjects(
                        this.userData.campaign_hidden_until || {},
                        incomingUserData.campaign_hidden_until || {}
                    ),
                };
                break;
            default:
                throw new Error(`Invalid policy: ${policy}`);
        }
    }

    private static async _updateExternalUserId() {
        this.userData.external_user_id = await NotiflyStorage.getItem(NotiflyStorageKeys.EXTERNAL_USER_ID);
    }

    static getMessageLogs(campaignId: string) {
        const logs = UserStateManager.userData.campaign_hidden_until?.[`${campaignId}_message_logs`];
        return logs;
    }
}
