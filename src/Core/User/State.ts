/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Campaign, ReEligibleCondition } from '../Interfaces/Campaign';
import type { EventIntermediateCounts, UserData } from '../Interfaces/User';

import { SdkState, SdkStateManager } from '../SdkState';
import { NotiflyStorage, NotiflyStorageKeys } from '../Storage';
import { NotiflyAPI } from '../API';
import { reEligibleConditionUnitToSec } from './Utils';

import {
    getKSTCalendarDateString,
    isValidCampaignData,
    isValidEventIntermediateCounts,
    isValidUserData,
    isValidWebMessageState,
} from './Utils';

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

    static async sync(useStorageIfAvailable = true): Promise<void> {
        await this._syncState(useStorageIfAvailable);
        await this._updateExternalUserId();
    }

    static async refresh() {
        if (SdkStateManager.state !== SdkState.READY) {
            console.error('[Notifly] Cannot refresh state when the SDK is not ready. Ignoring refreshState call.');
            return;
        }
        SdkStateManager.state = SdkState.REFRESHING;
        try {
            await this._syncState(false);
            SdkStateManager.state = SdkState.READY;
        } catch (error) {
            console.error('[Notifly] Failed to refresh state: ', error);
            SdkStateManager.state = SdkState.FAILED;
        }
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

        NotiflyStorage.setItem(NotiflyStorageKeys.NOTIFLY_USER_STATE, JSON.stringify(this.state));
    }

    static updateUserData(params: Record<string, any>) {
        if (!this.userData.user_properties) {
            this.userData.user_properties = {};
        }

        Object.keys(params).forEach((key) => {
            this.userData.user_properties && (this.userData.user_properties[key] = params[key]);
        });

        NotiflyStorage.setItem(NotiflyStorageKeys.NOTIFLY_USER_STATE, JSON.stringify(this.state));
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

    private static async _syncState(useStorageIfAvailable = true): Promise<void> {
        if (useStorageIfAvailable) {
            // Get state from storage, if available
            const storedState = await NotiflyStorage.getItem(NotiflyStorageKeys.NOTIFLY_USER_STATE);
            try {
                const parsedStateJSON = storedState ? JSON.parse(storedState) : null;
                if (isValidWebMessageState(parsedStateJSON)) {
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

        if (isValidEventIntermediateCounts(data.eventIntermediateCountsData)) {
            this.eventIntermediateCounts = data.eventIntermediateCountsData;
        } else {
            this.eventIntermediateCounts = [];
        }
        if (isValidCampaignData(data.campaignData)) {
            this.inWebMessageCampaigns = data.campaignData.filter((c: Campaign) => c.channel === 'in-web-message');
        } else {
            this.inWebMessageCampaigns = [];
        }
        if (isValidUserData(data.userData)) {
            this.userData = data.userData;
        } else {
            this.userData = {};
        }

        await this._updateExternalUserId();
        await NotiflyStorage.setItem(NotiflyStorageKeys.NOTIFLY_USER_STATE, JSON.stringify(this.state));
    }

    private static async _updateExternalUserId() {
        this.userData.external_user_id = await NotiflyStorage.getItem(NotiflyStorageKeys.EXTERNAL_USER_ID);
    }

    static getMessageLogs(campaignId: string) {
        const logs = UserStateManager.userData.campaign_hidden_until?.[`${campaignId}_message_logs`];
        return logs;
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
}
