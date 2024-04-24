import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';

import { EventIntermediateCounts } from '../Interfaces/User';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function getKSTCalendarDateString(daysOffset = 0) {
    const kstDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
    kstDate.setDate(kstDate.getDate() + daysOffset);
    return kstDate.toISOString().split('T')[0];
}

export function isValidUserState(state: any): boolean {
    if (!state) {
        return false;
    }

    return (
        isValidCampaignData(state.inWebMessageCampaigns) &&
        isValidUserData(state.userData) &&
        isValidEventIntermediateCounts(state.eventIntermediateCounts)
    );
}

export function isValidEventIntermediateCounts(eics: any): boolean {
    if (!eics || !Array.isArray(eics)) {
        return false;
    }

    return eics.every((eic) => _isValidEventIntermediateCount(eic));
}

export function isValidCampaignData(campaignData: any): boolean {
    // TODO: extra validation
    return campaignData && Array.isArray(campaignData);
}

export function isValidUserData(userData: any): boolean {
    // TODO: extra validation
    return userData && typeof userData === 'object';
}

export function sanitizeRandomBucketNumber(randomBucketNumber: unknown): number {
    if (typeof randomBucketNumber === 'number') {
        return randomBucketNumber;
    }
    if (typeof randomBucketNumber === 'string') {
        const parsed = parseInt(randomBucketNumber, 10);
        if (isNaN(parsed)) {
            return 0;
        }
        return parsed;
    }
    return 0;
}

export const reEligibleConditionUnitToSeconds: Record<string, number> = {
    h: 3600,
    d: 24 * 3600,
    w: 7 * 24 * 3600,
    m: 30 * 24 * 3600,
};

export function mergeEventCounts(first: EventIntermediateCounts[], second: EventIntermediateCounts[]) {
    const merged: EventIntermediateCounts[] = cloneDeep(first);
    for (const eventCount of second) {
        const index = merged.findIndex((eic) => _areEventIntermediateCountsMergeable(eic, eventCount));
        if (index === -1) {
            merged.push(eventCount);
        } else {
            merged[index].count += eventCount.count;
        }
    }
    return merged;
}

export function mergeObjects(first: Record<string, any>, second: Record<string, any>) {
    return {
        ...first,
        ...second,
    };
}

function _isValidEventIntermediateCount(eic: any): boolean {
    // dt should be YYYY-MM-DD format
    if (
        eic &&
        eic.dt &&
        typeof eic.dt === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(eic.dt) &&
        eic.name &&
        typeof eic.name === 'string' &&
        eic.count &&
        typeof eic.count === 'number' &&
        eic.event_params &&
        typeof eic.event_params === 'object'
    ) {
        return true;
    } else {
        return false;
    }
}

function _areEventIntermediateCountsMergeable(a: EventIntermediateCounts, b: EventIntermediateCounts): boolean {
    return a.dt === b.dt && a.name === b.name && isEqual(a.event_params, b.event_params);
}
