import type { Campaign, Condition, UserData, EventIntermediateCounts } from './types';
import { scheduleInWebMessage } from './webMessageUtils';
import localForage from './localforage';
import { saveCognitoIdToken } from './auth';

const SYNC_STATE_MAX_RETRY_COUNT = 3;

let eventIntermediateCounts: EventIntermediateCounts[] = [];
let inWebMessageCampaigns: Campaign[] = [];
let userData: UserData = {};

async function refreshState() {
    try {
        const [projectID, notiflyUserID, notiflyDeviceID] = await Promise.all([
            localForage.getItem<string>('__notiflyProjectID'),
            localForage.getItem<string>('__notiflyUserID'),
            localForage.getItem<string>('__notiflyDeviceID'),
        ]);
        if (projectID && notiflyUserID) {
            await syncState(projectID, notiflyUserID, notiflyDeviceID);
        }
    } catch (err) {
        console.warn('[Notifly] refreshState failed: ', err);
    }
}

async function syncState(
    projectID: string,
    notiflyUserID: string,
    notiflyDeviceID: string | null,
    retryCount = 0
): Promise<void> {
    try {
        const cognitoIdToken = await localForage.getItem<string>('__notiflyCognitoIDToken');
        const response = await fetch(
            `https://api.notifly.tech/user-state/${projectID}/${notiflyUserID}?${
                notiflyDeviceID ? `deviceId=${notiflyDeviceID}` : ''
            }`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${cognitoIdToken}`,
                },
            }
        );

        if (!response.ok) {
            if (retryCount < SYNC_STATE_MAX_RETRY_COUNT) {
                if (response.status === 401) {
                    // Invalid token
                    const [userName, password] = await Promise.all([
                        localForage.getItem<string>('__notiflyUserName'),
                        localForage.getItem<string>('__notiflyPassword'),
                    ]);
                    await saveCognitoIdToken(userName || '', password || '');
                }
                return await syncState(projectID, notiflyUserID, notiflyDeviceID, retryCount + 1);
            } else {
                throw new Error(response.statusText);
            }
        }

        const data = await response.json();
        if (data.eventIntermediateCountsData != null) {
            eventIntermediateCounts = data.eventIntermediateCountsData;
        }
        if (data.campaignData != null) {
            inWebMessageCampaigns = data.campaignData.filter((c: Campaign) => c.channel === 'in-web-message');
        }
        if (data.userData != null) {
            userData = data.userData;
        }
        return data;
    } catch (error) {
        console.error('Error:', error);
    }
}

function updateUserData(params: Record<string, any>) {
    Object.keys(params).map((key) => {
        if (userData && userData.user_properties) {
            userData.user_properties[key] = params[key];
        }
    });
}

function updateEventIntermediateCounts(
    eventName: string,
    eventParams: Record<string, any>,
    segmentationEventParamKeys?: string[] | null
) {
    const currentDate = new Date();
    const _month = currentDate.getMonth() + 1;
    const month = _month < 10 ? `0${_month}` : _month;
    const formattedDate = `${currentDate.getFullYear()}-${month}-${currentDate.getDate()}`;

    const keyField = segmentationEventParamKeys ? segmentationEventParamKeys[0] : null;

    const existingRow = eventIntermediateCounts.find((row) => row.dt === formattedDate && row.name === eventName);
    if (existingRow) {
        // If an existing row is found, increase the count by 1
        const rowIndex = eventIntermediateCounts.indexOf(existingRow);
        eventIntermediateCounts[rowIndex].count += 1;
    } else {
        // If no existing row is found, create a new entry
        const newRow = {
            dt: formattedDate,
            name: eventName,
            count: 1,
        };
        eventIntermediateCounts = [...eventIntermediateCounts, newRow];
    }
}

function checkCondition(campaign: Campaign): boolean {
    if (campaign.segment_type !== 'condition') {
        // This function should be called for condition-based user segmentation only
        return false;
    }

    const message = campaign.message;
    const modalProperties = message.modal_properties;
    const templateName = modalProperties.template_name;
    if (userData && userData.user_properties) {
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const hideUntilTimestamp = userData.user_properties[`hide_in_web_message_${templateName}`];
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

        if (conditions.every(checkConditionForSingleCondition)) {
            return true;
        }
    }

    return false;
}

function checkConditionForSingleCondition(condition: Condition) {
    const { attribute, event, event_condition_type, operator, secondary_value, unit, value } = condition;

    if (unit === 'event') {
        if (event_condition_type === 'count X') {
            const totalCount = eventIntermediateCounts.reduce((sum, row) => {
                if (row.name === event) {
                    return sum + row.count;
                }
                return sum;
            }, 0);

            if (operator === '>=') {
                return totalCount >= value;
            } else if (operator === '<=') {
                return totalCount <= value;
            } else if (operator === '<') {
                return totalCount < value;
            } else if (operator === '>') {
                return totalCount > value;
            } else if (operator === '=') {
                return totalCount === value;
            }
        } else if (event_condition_type === 'count X in Y days') {
            const currentDate = new Date();
            const recentDts = eventIntermediateCounts
                .filter((row) => row.name === event)
                .filter((row) => {
                    const rowDate = new Date(row.dt);
                    const rowFormattedDate = rowDate.toISOString().slice(0, 10); // Convert rowDate to 'YYYY-MM-DD' format
                    const currentFormattedDate = currentDate.toISOString().slice(0, 10); // Convert currentDate to 'YYYY-MM-DD' format

                    return (
                        rowFormattedDate <= currentFormattedDate &&
                        currentFormattedDate <=
                            new Date(rowDate.getTime() + secondary_value * 24 * 60 * 60 * 1000)
                                .toISOString()
                                .slice(0, 10)
                    );
                })
                .map((row) => row.count);

            const sumOfCounts = recentDts.reduce((sum, count) => sum + count, 0);

            if (operator === '>=') {
                return sumOfCounts >= value;
            } else if (operator === '<=') {
                return sumOfCounts <= value;
            } else if (operator === '<') {
                return sumOfCounts < value;
            } else if (operator === '>') {
                return sumOfCounts > value;
            } else if (operator === '=') {
                return sumOfCounts === value;
            }
        }
    } else if (unit === 'user') {
        const userProperties = userData.user_properties;

        if (!userProperties) {
            return false; // No user properties
        }

        if (!(attribute in userProperties)) {
            return false; // Attribute not found in user_properties
        }

        const userValue = userProperties[attribute];

        switch (operator) {
            case '=':
                return userValue == value;
            case '!=':
            case '<>':
                return userValue != value;
            case '>':
                return userValue > value;
            case '>=':
                return userValue >= value;
            case '<':
                return userValue < value;
            case '<=':
                return userValue <= value;
            default:
                return false;
        }
    }

    return false;
}

/**
 * Compare function for sorting campaigns by delay in ascending order.
 * If those are equal, sort by last_updated_timestamp in descending order.
 */
function _compareCampaigns(a: Campaign, b: Campaign) {
    const delayA = a.delay || 0;
    const delayB = b.delay || 0;

    if (delayA < delayB) {
        return -1;
    } else if (delayA > delayB) {
        return 1;
    } else {
        return a.last_updated_timestamp > b.last_updated_timestamp ? -1 : 1;
    }
}

/**
 * This function assumes that all campaigns should be scheduled and sorted with _compareCampaigns function.
 * This function removes campaigns that are scheduled to be shown at the same time.
 * When there are multiple campaigns scheduled to be shown at the same time, the one with the latest last_updated_timestamp will be chosen.
 */
function _removeConflictingCampaigns(campaigns: Campaign[]) {
    if (campaigns.length <= 1) {
        return campaigns;
    }

    const sortedCampaigns = campaigns.sort(_compareCampaigns);
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
 * Get campaigns to schedule.
 */
function _getCampaignsToSchedule(campaigns: Campaign[], eventName: string) {
    return _removeConflictingCampaigns(
        campaigns.filter((c) => c.triggering_event === eventName).filter(checkCondition)
    );
}

function maybeTriggerWebMessage(eventName: string) {
    _getCampaignsToSchedule(inWebMessageCampaigns, eventName).forEach(scheduleInWebMessage);
}

// Test-only getter for eventIntermediateCounts
function getEventIntermediateCountsForTest() {
    return eventIntermediateCounts;
}

// Test-only setter for eventIntermediateCounts
function setEventIntermediateCountsForTest(newEventIntermediateCounts: EventIntermediateCounts[]) {
    eventIntermediateCounts = newEventIntermediateCounts;
}

// Test-only setter for userData
function setUserDataForTest(newUserData: UserData) {
    userData = newUserData;
}

// Test-only
const checkConditionForTest = checkCondition;

export {
    refreshState,
    syncState,
    updateUserData,
    updateEventIntermediateCounts,
    maybeTriggerWebMessage,
    // Test-only
    getEventIntermediateCountsForTest,
    setEventIntermediateCountsForTest,
    checkConditionForTest,
    setUserDataForTest,
    // Test-only exported
    _getCampaignsToSchedule,
};
