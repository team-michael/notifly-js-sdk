/* eslint-disable @typescript-eslint/no-explicit-any */
export function getKSTCalendarDateString(daysOffset = 0) {
    const kstDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
    kstDate.setDate(kstDate.getDate() + daysOffset);
    return kstDate.toISOString().split('T')[0];
}

export function isValidWebMessageState(state: any): boolean {
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

export const reEligibleConditionUnitToSec: Record<string, number> = {
    h: 3600,
    d: 24 * 3600,
    w: 7 * 24 * 3600,
    m: 30 * 24 * 3600,
};

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
