import { v4 } from 'uuid';
import localForage from './LocalForage';

import { APIManager } from './API/Manager';
import { WebMessageManager } from './WebMessages/Manager';
import { generateNotiflyUserID, getPlatform } from './Utils';
import { SDK_VERSION } from './Constants';

const NOTIFLY_LOG_EVENT_URL = 'https://12lnng07q2.execute-api.ap-northeast-2.amazonaws.com/prod/records';

async function logEvent(
    eventName: string,
    eventParams: Record<string, any>,
    segmentationEventParamKeys: string[] | null = null,
    isInternalEvent = false
): Promise<void> {
    try {
        const [projectID, deviceToken, notiflyDeviceID, externalUserID] = await Promise.all([
            localForage.getItem<string>('__notiflyProjectID'),
            localForage.getItem<string>('__notiflyDeviceToken'),
            localForage.getItem<string>('__notiflyDeviceID'),
            localForage.getItem<string>('__notiflyExternalUserID'),
        ]);

        if (!projectID) {
            console.error('[Notifly] Project ID should be set before logging an event.');
            return;
        }

        let notiflyUserID = await localForage.getItem('__notiflyUserID');
        if (!notiflyUserID) {
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

        await APIManager.call(
            NOTIFLY_LOG_EVENT_URL,
            'POST',
            {
                'records': [
                    {
                        'data': JSON.stringify(data),
                        'partitionKey': notiflyUserID,
                    },
                ],
            },
            'follow'
        );

        WebMessageManager.updateEventCountsAndMaybeTriggerWebMessages(
            isInternalEvent ? `notifly__${eventName}` : eventName,
            eventParams,
            externalUserID,
            segmentationEventParamKeys
        );
    } catch (err) {
        console.error('[Notifly] Error logging event', err);
    }
}

async function sessionStart(): Promise<void> {
    const notifAuthStatus =
        typeof Notification === 'undefined' ? -1 : mapNotificationPermissionToEnum(Notification.permission);
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
