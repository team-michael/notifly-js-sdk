/* eslint-disable @typescript-eslint/no-explicit-any */
import { v4 } from 'uuid';

import { NotiflyStorage, NotiflyStorageKeys } from './Storage';

import { SdkStateManager } from './SdkState';
import { NotiflyAPI } from './API';
import { WebMessageManager } from './WebMessages/Manager';
import {
    generateNotiflyUserId,
    getCurrentTimezoneId,
    getPlatform,
    getTimestampMicroseconds,
    mapNotificationPermissionToEnum,
} from './Utils';

const NOTIFLY_LOG_EVENT_URL = 'https://e.notifly.tech/records';

export enum NotiflyInternalEvent {
    SESSION_START = 'session_start',
    SET_USER_PROPERTIES = 'set_user_properties',
    REMOVE_EXTERNAL_USER_ID = 'remove_external_user_id',
    IN_WEB_MESSAGE_SHOW = 'in_web_message_show',
    MAIN_BUTTON_CLICK = 'main_button_click',
    CLOSE_BUTTON_CLICK = 'close_button_click',
    HIDE_IN_WEB_MESSAGE = 'hide_in_web_message',
}

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
        return await EventLogger.logEvent(
            NotiflyInternalEvent.SESSION_START,
            { notif_auth_status: notifAuthStatus, timezone: getCurrentTimezoneId() },
            null,
            true
        );
    }

    private static async _logEvent(
        eventName: string,
        eventParams: Record<string, any>,
        segmentationEventParamKeys: string[] | null = null,
        isInternalEvent = false
    ): Promise<void> {
        try {
            const [projectId, notiflyDeviceId, externalUserId] = await NotiflyStorage.getItems([
                NotiflyStorageKeys.PROJECT_ID,
                NotiflyStorageKeys.NOTIFLY_DEVICE_ID,
                NotiflyStorageKeys.EXTERNAL_USER_ID,
            ]);
            if (!projectId || !notiflyDeviceId) {
                throw new Error('Notifly storage is not initialized');
            }
            const notiflyUserId = generateNotiflyUserId(projectId, externalUserId, notiflyDeviceId);

            if (!projectId) {
                throw new Error('Project ID should be set before logging an event.');
            }

            const data: any = {
                id: v4().replace(/-/g, ''),
                project_id: projectId,
                name: eventName,
                event_params: eventParams,
                is_internal_event: isInternalEvent,
                segmentation_event_param_keys: segmentationEventParamKeys,
                sdk_version: SdkStateManager.version,
                sdk_type: SdkStateManager.type,
                time: getTimestampMicroseconds(),
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

            this._assertEventValidity(data);

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

    private static _assertEventValidity(data: any) {
        const {
            name,
            is_internal_event: isInternalEvent,
            project_id: projectId,
            notifly_user_id: notiflyUserId,
            notifly_device_id: notiflyDeviceId,
            external_user_id: externalUserId,
        } = data;

        if (isInternalEvent && name === NotiflyInternalEvent.REMOVE_EXTERNAL_USER_ID) {
            /**
             * For the case of remove external user ID internal event,
             * external user ID must have been removed before logging the event.
             */
            if (externalUserId) {
                throw new Error('external user ID must be removed before "remove_external_user_id" event.');
            }
        }

        // Check synchronization between external user ID and Notifly user ID
        const expectedNotiflyUserId = generateNotiflyUserId(projectId, externalUserId, notiflyDeviceId);
        if (notiflyUserId !== expectedNotiflyUserId) {
            throw new Error('Notifly user ID is not synchronized with external user ID.');
        }
    }
}
