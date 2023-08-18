import { v4 } from 'uuid';

import { SDK_VERSION } from '../Constants';

import { NotiflyStorage, NotiflyStorageKeys } from '../Storage';

import { SdkStateManager } from '../SdkState';
import { APIManager } from '../API/Manager';
import { PendingEventManager } from './PendingEventManager';
import { WebMessageManager } from '../WebMessages/Manager';
import { generateNotiflyUserId, getPlatform, mapNotificationPermissionToEnum } from '../Utils';

const NOTIFLY_LOG_EVENT_URL = 'https://12lnng07q2.execute-api.ap-northeast-2.amazonaws.com/prod/records';

export class EventManager {
    private static _pendingEventManager = new PendingEventManager();

    static async logEvent(
        eventName: string,
        eventParams: Record<string, any>,
        segmentationEventParamKeys: string[] | null = null,
        isInternalEvent = false
    ): Promise<void> {
        if (!isInternalEvent && !SdkStateManager.isReady()) {
            if (SdkStateManager.isRefreshing()) {
                await this._pendingEventManager.dispatchEventAndWaitForSdkEvent(eventName, 'refresh_completed');
            } else if (SdkStateManager.isNotInitialized()) {
                await this._pendingEventManager.dispatchEventAndWaitForSdkEvent(eventName, 'initialized');
            } else {
                // Failed
                console.warn('[Notifly] Ignoring logEvent call because the SDK is in a failed state.');
                return;
            }
        }
        // Internal events are validated outside of this function.
        await this._logEvent(eventName, eventParams, segmentationEventParamKeys, isInternalEvent);
    }

    private static async _logEvent(
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
                sdk_type: SdkStateManager.type,
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
            if (SdkStateManager.source) {
                data.source = SdkStateManager.source;
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

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts(
                isInternalEvent ? `notifly__${eventName}` : eventName,
                eventParams,
                externalUserID,
                segmentationEventParamKeys
            );
        } catch (err) {
            console.error('[Notifly] Error logging event', err);
        }
    }

    static async sessionStart(): Promise<void> {
        const notifAuthStatus =
            typeof Notification === 'undefined' ? -1 : mapNotificationPermissionToEnum(Notification.permission);
        return await EventManager.logEvent('session_start', { notif_auth_status: notifAuthStatus }, null, true);
    }
}
