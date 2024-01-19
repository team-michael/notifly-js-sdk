/* eslint-disable @typescript-eslint/no-explicit-any */
import { v4 } from 'uuid';

import { NotiflyStorage, NotiflyStorageKeys } from './Storage';

import { SdkStateManager } from './SdkState';
import { NotiflyAPI } from './API';
import { WebMessageManager } from './WebMessages/Manager';
import { getPlatform, mapNotificationPermissionToEnum } from './Utils';

const NOTIFLY_LOG_EVENT_URL = 'https://12lnng07q2.execute-api.ap-northeast-2.amazonaws.com/prod/records';

export class EventLogger {
    static async logEvent(
        eventName: string,
        eventParams: Record<string, any>,
        segmentationEventParamKeys: string[] | null = null,
        isInternalEvent = false
    ): Promise<void> {
        await this._logEvent(eventName, eventParams, segmentationEventParamKeys, isInternalEvent);
    }

    static async sessionStart(): Promise<void> {
        const notifAuthStatus =
            typeof Notification === 'undefined' ? -1 : mapNotificationPermissionToEnum(Notification.permission);
        return await EventLogger.logEvent('session_start', { notif_auth_status: notifAuthStatus }, null, true);
    }

    private static async _logEvent(
        eventName: string,
        eventParams: Record<string, any>,
        segmentationEventParamKeys: string[] | null = null,
        isInternalEvent = false
    ): Promise<void> {
        try {
            const [projectID, notiflyDeviceId, notiflyUserId, externalUserId] = await NotiflyStorage.getItems([
                NotiflyStorageKeys.PROJECT_ID,
                NotiflyStorageKeys.NOTIFLY_DEVICE_ID,
                NotiflyStorageKeys.NOTIFLY_USER_ID,
                NotiflyStorageKeys.EXTERNAL_USER_ID,
            ]);

            if (!projectID) {
                throw new Error('Project ID should be set before logging an event.');
            }

            const data: any = {
                id: v4().replace(/-/g, ''),
                project_id: projectID,
                name: eventName,
                event_params: eventParams,
                is_internal_event: isInternalEvent,
                segmentation_event_param_keys: segmentationEventParamKeys,
                sdk_version: SdkStateManager.version,
                sdk_type: SdkStateManager.type,
                time: Date.now(),
                platform: getPlatform(),
            };
            if (notiflyUserId) {
                data.notifly_user_id = notiflyUserId;
            }
            if (notiflyDeviceId) {
                data.notifly_device_id = notiflyDeviceId;
            }
            if (externalUserId) {
                data.external_user_id = externalUserId;
            }
            if (SdkStateManager.source) {
                data.source = SdkStateManager.source;
            }

            await NotiflyAPI.call(
                NOTIFLY_LOG_EVENT_URL,
                'POST',
                {
                    'records': [
                        {
                            'data': JSON.stringify(data),
                            'partitionKey': notiflyUserId,
                        },
                    ],
                },
                'follow'
            );

            WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts(
                isInternalEvent ? `notifly__${eventName}` : eventName,
                eventParams,
                externalUserId,
                segmentationEventParamKeys
            );
        } catch (err) {
            console.error('[Notifly] Error logging event', err);
        }
    }
}
