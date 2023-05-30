interface Campaign {
    channel: string;
    segment_type: string;
    message: {
        html_url: string;
    };
    segment_info?: {
        groups?: {
            conditions?: Condition[];
        }[];
        group_operator?: string;
    };
    triggering_event: string;
    delay: number;
}
interface EventIntermediateCounts {
    dt: string;
    name: string;
    count: number;
}
interface Condition {
    attribute: string;
    event: string;
    event_condition_type: string;
    operator: string;
    secondary_value: number;
    unit: string;
    value: any;
}
interface UserData {
    user_properties?: {
        [key: string]: any;
    };
}

let eventIntermediateCounts: EventIntermediateCounts[] = [];
let inWebMessageCampaigns: Campaign[] = [];
let userData: UserData = {};

async function syncState(projectID: string, notiflyUserID: string): Promise<void> {
    const endpoint =
        'https://om97mq7cx4.execute-api.ap-northeast-2.amazonaws.com/default/notifly-js-sdk-user-state-retrieval';
    const queryParams = {
        projectID: projectID,
        notiflyUserID: notiflyUserID,
    };

    const url = new URL(endpoint);
    const searchParams = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
        searchParams.append(key, value);
    });
    url.search = searchParams.toString();

    try {
        const response = await fetch(url.toString());
        const data = await response.json();

        eventIntermediateCounts = data.eventIntermediateCountsData;
        inWebMessageCampaigns = data.campaignData.filter((c: Campaign) => c.channel === 'in-web-message');
        userData = data.userData;

        return data;
    } catch (error) {
        console.error('Error:', error);
    }
}

function updateUserData(params: Record<string, any>) {
    Object.keys(params).map((key) => {
        if (userData.user_properties) {
            userData.user_properties[key] = params[key];
        }
    });
}

function updateEventIntermediateCounts(eventName: string) {
    // Create a new Date object for the current date
    const currentDate = new Date();

    // Get the current year, month, and day
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Months are zero-based, so we add 1
    const day = String(currentDate.getDate()).padStart(2, '0');

    // Create the formatted date string
    const formattedDate = year + '-' + month + '-' + day;

    // Check if an object with the given dt and name already exists
    const existingRow = eventIntermediateCounts.find((row) => row.dt === formattedDate && row.name === eventName);

    if (existingRow) {
        // If an existing row is found, increase the count by 1
        const updatedRows = eventIntermediateCounts.map((row) => {
            if (row.dt === formattedDate && row.name === eventName) {
                return { ...row, count: row.count + 1 };
            }
            return row;
        });
        eventIntermediateCounts = updatedRows;
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

function maybeTriggerWebMessage(eventName: string) {
    inWebMessageCampaigns
        .filter((c) => c.triggering_event === eventName)
        .map((c) => {
            if (checkCondition(c)) {
                const iframe = document.createElement('iframe');
                iframe.src = c.message.html_url;
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.style.zIndex = '10';
                iframe.style.position = 'absolute';

                const delayInSeconds = c.delay ?? 0;
                setTimeout(() => {
                    document.body.appendChild(iframe);
                }, delayInSeconds * 1000);
            }
        });
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
    syncState,
    updateUserData,
    updateEventIntermediateCounts,
    maybeTriggerWebMessage,
    // Test-only
    getEventIntermediateCountsForTest,
    setEventIntermediateCountsForTest,
    checkConditionForTest,
    setUserDataForTest,
};
