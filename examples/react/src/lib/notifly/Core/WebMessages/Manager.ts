/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotiflyInternalEvent } from '../Event';
import {
    CampaignStatus,
    TriggeringConditionUnit,
    TriggeringConditions,
    type Campaign,
    type Condition,
    type Operator,
    type SegmentConditionUnitType,
    type TriggeringEventFilterUnit,
    type TriggeringEventFilters,
} from '../Interfaces/Campaign';
import type { UserData, DeviceProperties, UserMetadataProperties } from '../Interfaces/User';

import { UserStateManager } from '../User/State';
import { WebMessageScheduler } from './Scheduler';

import { ValueComparator, getKSTCalendarDateString, isValueNotPresent } from './Utils';

export class WebMessageManager {
    static async initialize(hard = false) {
        await UserStateManager.sync({
            useStorageIfAvailable: !hard,
        });
        WebMessageScheduler.initialize();
    }

    static maybeTriggerWebMessagesAndUpdateEventCounts(
        eventName: string,
        eventParams: Record<string, any>,
        externalUserID: string | null,
        segmentationEventParamKeys?: string[] | null
    ) {
        this._triggerWebMessages(eventName, eventParams, externalUserID);
        UserStateManager.updateEventCounts(eventName, eventParams, segmentationEventParamKeys);
    }

    private static _triggerWebMessages(
        eventName: string,
        eventParams: Record<string, any>,
        externalUserID: string | null
    ) {
        const schedule = () =>
            this._getCampaignsToSchedule(
                UserStateManager.inWebMessageCampaigns,
                eventName,
                eventParams,
                externalUserID
            ).forEach(WebMessageScheduler.scheduleInWebMessage.bind(WebMessageScheduler));

        if (document.readyState === 'complete') {
            schedule();
        } else {
            const task = () => {
                schedule();
                window.removeEventListener('DOMContentLoaded', task);
            };
            window.addEventListener('DOMContentLoaded', task);
        }
    }

    /**
     * Get campaigns to schedule.
     */
    private static _getCampaignsToSchedule(
        campaigns: Campaign[],
        eventName: string,
        eventParams: Record<string, any>,
        externalUserID: string | null
    ) {
        const campaignsToTrigger = campaigns.filter(
            (campaign) =>
                this._isCampaignActive(campaign) &&
                this._isEventApplicableForCampaign(campaign, eventName, eventParams) &&
                this._isEntityOfSegment(campaign, eventParams, externalUserID)
        );
        return this._compactCampaigns(campaignsToTrigger);
    }

    /**
     * Compare function for sorting campaigns by delay in ascending order.
     * If those are equal, sort by updated_at in descending order.
     */
    private static _compareCampaigns(a: Campaign, b: Campaign) {
        const delayA = a.delay || 0;
        const delayB = b.delay || 0;

        if (delayA < delayB) {
            return -1;
        } else if (delayA > delayB) {
            return 1;
        } else {
            return a.updated_at > b.updated_at ? -1 : 1;
        }
    }

    /**
     * This function assumes that all campaigns should be scheduled and sorted with _compareCampaigns function.
     * This function removes campaigns that are scheduled to be shown at the same time.
     * When there are multiple campaigns scheduled to be shown at the same time, the one with the latest updated_at will be chosen.
     */
    private static _compactCampaigns(campaigns: Campaign[]) {
        if (campaigns.length <= 1) {
            return campaigns;
        }

        const sortedCampaigns = campaigns.sort(this._compareCampaigns);
        const result: Campaign[] = [sortedCampaigns[0]];

        let seenDelay = sortedCampaigns[0].delay || 0;
        for (let idx = 1; idx < sortedCampaigns.length; idx++) {
            const campaign = sortedCampaigns[idx];
            const delay = campaign.delay || 0;

            if (delay !== seenDelay) {
                result.push(campaign);
                seenDelay = delay;
            }
        }

        return result;
    }

    /**
     * Functions below are helpers for checking whether a campaign should be scheduled or not.
     */
    private static _isCampaignActive(campaign: Campaign) {
        if (!campaign.starts?.[0]) {
            return false;
        }

        return (
            campaign.status === CampaignStatus.ACTIVE &&
            campaign.starts[0] <= Math.floor(Date.now() / 1000) &&
            (!campaign.end || campaign.end > Math.floor(Date.now() / 1000))
        );
    }

    private static _isEventApplicableForCampaign(
        campaign: Campaign,
        eventName: string,
        eventParams: Record<string, any>
    ) {
        if (!campaign.triggering_conditions) {
            console.error('[Notifly] Campaign does not have triggering conditions');
            return false;
        }
        if (!this._matchTriggeringConditions(campaign.triggering_conditions, eventName)) {
            return false;
        }

        const triggeringEventFilters = campaign.triggering_event_filters;
        if (triggeringEventFilters) {
            if (!this._matchTriggeringEventFilters(triggeringEventFilters, eventParams)) {
                // Event parameters do not match
                return false;
            }
        }
        return true;
    }

    private static _matchTriggeringConditions(triggeringConditions: TriggeringConditions, eventName: string) {
        return triggeringConditions.some((group) =>
            group.every((unit) => this._matchTriggeringConditionUnit(unit, eventName))
        );
    }

    private static _matchTriggeringConditionUnit(conditionUnit: TriggeringConditionUnit, eventName: string) {
        const { operator, operand } = conditionUnit;

        switch (operator) {
            case '=':
                return eventName === operand;
            case '!=':
                return eventName !== operand;
            case 'starts_with':
                return eventName.startsWith(operand);
            case 'does_not_start_with':
                return !eventName.startsWith(operand);
            case 'ends_with':
                return eventName.endsWith(operand);
            case 'does_not_end_with':
                return !eventName.endsWith(operand);
            case 'contains':
                return eventName.includes(operand);
            case 'does_not_contain':
                return !eventName.includes(operand);
            case 'matches_regex': {
                try {
                    return new RegExp(operand).test(eventName);
                } catch (e) {
                    return false;
                }
            }
            case 'does_not_match_regex': {
                try {
                    return !new RegExp(operand).test(eventName);
                } catch (e) {
                    return false;
                }
            }
            default:
                console.error(
                    `[Notifly] Encountered unexpected error while parsing triggering conditions: invalid operator ${operator}`
                );
                return false;
        }
    }

    private static _matchTriggeringEventFilters(
        triggeringEventFilters: TriggeringEventFilters,
        eventParams: Record<string, any>
    ) {
        for (const filter of triggeringEventFilters) {
            if (filter.every((unit) => this._matchTriggeringEventFilterUnit(unit, eventParams))) {
                return true;
            }
        }
        return false;
    }

    private static _matchTriggeringEventFilterUnit(
        filterUnit: TriggeringEventFilterUnit,
        eventParams: Record<string, any>
    ) {
        const { key, operator, value, value_type: valueType } = filterUnit;
        if (!key) {
            return false;
        }

        const paramValue = eventParams[key];
        const isParamValueNotPresent = isValueNotPresent(paramValue);

        if (operator === 'IS_NULL') {
            return isParamValueNotPresent;
        }
        if (operator === 'IS_NOT_NULL') {
            return !isParamValueNotPresent;
        }

        if (isParamValueNotPresent || !valueType) {
            return false;
        }

        switch (operator) {
            case '=':
                return ValueComparator.IsEqual(paramValue, value, valueType);
            case '<>':
                return ValueComparator.IsNotEqual(paramValue, value, valueType);
            case '>':
                return ValueComparator.IsGreaterThan(paramValue, value, valueType);
            case '>=':
                return ValueComparator.IsGreaterThanOrEqual(paramValue, value, valueType);
            case '<':
                return ValueComparator.IsLessThan(paramValue, value, valueType);
            case '<=':
                return ValueComparator.IsLessThanOrEqual(paramValue, value, valueType);
            case '@>':
                return ValueComparator.Contains(paramValue, value, valueType);
            // IS_NULL and IS_NOT_NULL are handled above
            default:
                return false;
        }
    }

    private static _isEntityOfSegment(
        campaign: Campaign,
        eventParams: Record<string, any>,
        externalUserID: string | null
    ): boolean {
        if (campaign.segment_type !== 'condition') {
            // This function should be called for condition-based user segmentation only
            return false;
        }

        if (
            campaign.testing &&
            (!externalUserID || !campaign.whitelist || !campaign.whitelist.includes(externalUserID))
        ) {
            // This campaign is a testing campaign, but the user is not whitelisted
            return false;
        }

        if (campaign.re_eligible_condition) {
            const hideUntil = UserStateManager.userData.campaign_hidden_until?.[`${campaign.id}`];
            const currentTimestamp = Math.floor(Date.now() / 1000);
            if (hideUntil && currentTimestamp <= hideUntil) {
                // Hidden
                return false;
            }
        }

        const message = campaign.message;
        const modalProperties = message.modal_properties;
        const templateName = modalProperties.template_name;
        if (UserStateManager.userData && UserStateManager.userData.user_properties) {
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const hideUntilTimestamp =
                UserStateManager.userData.user_properties[
                    `${NotiflyInternalEvent.HIDE_IN_WEB_MESSAGE}_${templateName}`
                ];
            if (currentTimestamp <= hideUntilTimestamp) {
                // Hidden
                return false;
            }
        }

        const groups = campaign.segment_info?.groups;
        if (!groups || !groups.length) {
            return true;
        }

        // Assume 'and' operator for conditions, 'or' operator for groups
        for (const group of groups) {
            const { conditions } = group;

            if (!conditions || conditions.length === 0) {
                console.error('[Notifly] No condition present in group');
                return false;
            }

            if (conditions.every((condition) => this._matchCondition(condition, eventParams))) {
                return true;
            }
        }

        return false;
    }

    private static _matchCondition(condition: Condition, eventParams: Record<string, any>) {
        switch (condition.unit) {
            case 'event':
                return this._matchEventBasedCondition(condition);
            case 'user_metadata':
            case 'user':
            case 'device':
                return this._matchUserPropertyBasedCondition(condition, eventParams);
        }
    }

    private static _matchEventBasedCondition(condition: Condition) {
        const { event, event_condition_type, operator, secondary_value, value } = condition;

        if (typeof value !== 'number' || value < 0) {
            return false;
        }

        const _compare = (count: number, op: Operator, value: any) => {
            switch (op) {
                case '=':
                    return count === value;
                case '>':
                    return count > value;
                case '>=':
                    return count >= value;
                case '<':
                    return count < value;
                case '<=':
                    return count <= value;
                default:
                    return false;
            }
        };

        let totalCount: number;
        if (event_condition_type === 'count X') {
            totalCount = UserStateManager.eventIntermediateCounts.reduce((sum, row) => {
                if (row.name === event) {
                    return sum + row.count;
                }
                return sum;
            }, 0);
        } else if (event_condition_type === 'count X in Y days') {
            totalCount = UserStateManager.eventIntermediateCounts
                .filter((row) => row.name === event)
                .filter((row) => {
                    const start = getKSTCalendarDateString(-(secondary_value as number));
                    const end = getKSTCalendarDateString();

                    return row.dt >= start && row.dt <= end;
                })
                .map((row) => row.count)
                .reduce((sum, count) => sum + count, 0);
        } else {
            return false;
        }

        return _compare(totalCount, operator, value);
    }

    private static _matchUserPropertyBasedCondition(condition: Condition, eventParams: Record<string, any>) {
        const { unit, attribute, operator, useEventParamsAsConditionValue, comparison_parameter, valueType } =
            condition;

        const userAttributeValue = this._extractUserAttribute(unit, UserStateManager.userData, attribute as string);

        if (operator === 'IS_NULL') {
            return isValueNotPresent(userAttributeValue);
        }
        if (operator === 'IS_NOT_NULL') {
            return !isValueNotPresent(userAttributeValue);
        }

        if (!valueType) {
            return false;
        }

        let value;
        if (useEventParamsAsConditionValue) {
            value = eventParams[comparison_parameter as string];
        } else {
            value = condition.value;
        }
        if (!value) {
            return false;
        }

        switch (operator) {
            case '=':
                return ValueComparator.IsEqual(userAttributeValue, value, valueType);
            case '<>':
                return ValueComparator.IsNotEqual(userAttributeValue, value, valueType);
            case '>':
                return ValueComparator.IsGreaterThan(userAttributeValue, value, valueType);
            case '>=':
                return ValueComparator.IsGreaterThanOrEqual(userAttributeValue, value, valueType);
            case '<':
                return ValueComparator.IsLessThan(userAttributeValue, value, valueType);
            case '<=':
                return ValueComparator.IsLessThanOrEqual(userAttributeValue, value, valueType);
            case '@>':
                return ValueComparator.Contains(userAttributeValue, value, valueType);
            // IS_NULL is handled above
            default:
                return false;
        }
    }

    private static _extractUserAttribute(
        conditionUnit: SegmentConditionUnitType,
        userData: UserData,
        attributeToGet: string
    ) {
        switch (conditionUnit) {
            case 'user':
                return userData.user_properties?.[attributeToGet] || null;
            case 'user_metadata':
                return userData[attributeToGet as keyof UserMetadataProperties];
            case 'device':
                return userData[attributeToGet as keyof DeviceProperties];
            default:
                return null;
        }
    }

    public static isEntityOfSegment = this._isEntityOfSegment;
    public static isEventApplicableForCampaign = this._isEventApplicableForCampaign;
    public static getCampaignsToSchedule = this._getCampaignsToSchedule;
}
