import { v4 } from 'uuid';
import localForage from './LocalForage';

import { APIManager } from './API/Manager';
import { WebMessageManager } from './WebMessages/Manager';
import { generateNotiflyUserId, getPlatform } from './Utils';
import { SDK_VERSION } from './Constants';
import { NotiflyStorage, NotiflyStorageKeys } from './Storage';

const NOTIFLY_LOG_EVENT_URL = 'https://12lnng07q2.execute-api.ap-northeast-2.amazonaws.com/prod/records';

async function logEvent(
    eventName: string,
    eventParams: Record<string, any>,
    segmentationEventParamKeys: string[] | null = null,
    isInternalEvent = false
): Promise<void> {
    try {
        const [projectID, deviceToken, notiflyDeviceID, externalUserID] = await NotiflyStorage.getItems([
            NotiflyStorageKeys.PROJECT_ID,
            NotiflyStorageKeys.NOTIFLY_DEVICE_TOKEN,
            NotiflyStorageKeys.NOTIFLY_DEVICE_ID,
            NotiflyStorageKeys.EXTERNAL_USER_ID,
        ]);

        if (!projectID) {
            throw new Error('Project ID should be set before logging an event.');
        }

        let notiflyUserID = await NotiflyStorage.getItem(NotiflyStorageKeys.NOTIFLY_USER_ID);
        if (!notiflyUserID) {
            const generatedNotiflyUserID = await generateNotiflyUserId(
                projectID,
                externalUserID,
                deviceToken,
                notiflyDeviceID
            );
            notiflyUserID = generatedNotiflyUserID;
            await NotiflyStorage.setItem(NotiflyStorageKeys.NOTIFLY_USER_ID, generatedNotiflyUserID);
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
            time: Math.floor(Date.now() / 1000),
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
