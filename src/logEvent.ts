import { v4 } from 'uuid';
import localForage from './localforage';
import { SDK_VERSION } from './constants';
import { saveCognitoIdToken } from './auth';
import { generateNotiflyUserID, getPlatform } from './utils';
import { updateEventIntermediateCounts, maybeTriggerWebMessage } from './state';

const NOTIFLY_LOG_EVENT_URL = 'https://12lnng07q2.execute-api.ap-northeast-2.amazonaws.com/prod/records';
const MAX_RETRY_COUNT = 3;

async function logEvent(
    eventName: string,
    eventParams: Record<string, any>,
    segmentationEventParamKeys: string[] | null = null,
    isInternalEvent = false,
    retryCount = 0
): Promise<void> {
    try {
        const [projectID, deviceToken, cognitoIDToken, notiflyDeviceID, externalUserID] = await Promise.all([
            localForage.getItem<string>('__notiflyProjectID'),
            localForage.getItem<string>('__notiflyDeviceToken'),
            localForage.getItem<string>('__notiflyCognitoIDToken') || '',
            localForage.getItem<string>('__notiflyDeviceID'),
            localForage.getItem<string>('__notiflyExternalUserID'),
        ]);

        if (!projectID) {
            console.error('[Notifly] Project ID should be set before logging an event.');
            return;
        }

        let notiflyUserID = await localForage.getItem('__notiflyUserID');
        if (!notiflyUserID) {
            // Use generateNotiflyUserID to not call localForage again
            notiflyUserID = await generateNotiflyUserID(projectID, externalUserID, deviceToken, notiflyDeviceID);
        }

        const data: any = {
            id: v4().replace(/-/g, ''),
            project_id: projectID,
            name: eventName,
            event_params: eventParams,
            is_internal_event: isInternalEvent,
            segmentationEventParamKeys: segmentationEventParamKeys,
            sdk_version: SDK_VERSION,
            sdk_type: 'js',
            time: Math.floor(new Date().valueOf() / 1000),
            platform: getPlatform(),
        };
        if (notiflyUserID) {
            data.notifly_user_id = notiflyUserID;
        }
        if (deviceToken) {
            data.device_token = deviceToken;
        }
        if (notiflyDeviceID) {
            data.notifly_device_id = notiflyDeviceID;
        }
        if (externalUserID) {
            data.external_user_id = externalUserID;
        }

        const body = JSON.stringify({
            'records': [
                {
                    'data': JSON.stringify(data),
                    'partitionKey': notiflyUserID,
                },
            ],
        });
        // TODO: Handle null cognitoIDToken
        const requestOptions = _getRequestOptionsForLogEvent(cognitoIDToken || '', body);
        const response = await fetch(NOTIFLY_LOG_EVENT_URL, requestOptions);

        if (response.ok) {
            // Update state
            const eventNameForState = isInternalEvent ? `notifly__${eventName}` : eventName;
            updateEventIntermediateCounts(eventNameForState);
            // Handle web message campaigns
            maybeTriggerWebMessage(eventNameForState);
        } else {
            if (retryCount < MAX_RETRY_COUNT) {
                if (response.status === 401) {
                    // Token has been expired
                    const [userNameLocalStore, passwordLocalStore] = await Promise.all([
                        localForage.getItem<string>('__notiflyUserName'),
                        localForage.getItem<string>('__notiflyPassword'),
                    ]);
                    const userName = userNameLocalStore || '';
                    const password = passwordLocalStore || '';
                    await saveCognitoIdToken(userName, password);
                }

                await logEvent(eventName, eventParams, segmentationEventParamKeys, isInternalEvent, retryCount + 1);
            } else {
                throw new Error(response.statusText);
            }
        }
    } catch (err) {
        console.error('[Notifly] Error logging event', err);
    }
}

function _getRequestOptionsForLogEvent(token: string, body: string): RequestInit {
    const myHeaders = new Headers();
    myHeaders.append('Authorization', token);
    myHeaders.append('Content-Type', 'application/json');

    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: body,
        redirect: 'follow' as RequestRedirect,
    };
    return requestOptions;
}

async function sessionStart(): Promise<void> {
    const notifAuthStatus = (typeof Notification) === 'undefined' ? -1 : mapNotificationPermissionToEnum(Notification.permission);
    return await logEvent('session_start', { notif_auth_status: notifAuthStatus }, null, true);
}

function mapNotificationPermissionToEnum(permission: NotificationPermission): number {
    if (permission === 'denied') {
        return 0; // DENIED
    }

    if (permission === 'granted') {
        return 1; // AUTHORIZED
    }

    return -1; // NOT_DETERMINED
}

export { logEvent, sessionStart };
