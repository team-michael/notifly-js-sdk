import { Platform } from 'react-native';
import rnDeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { v5 as uuidv5 } from 'uuid';
import { NAMESPACE, SDK_VERSION } from './constant';
import { getNotiflyUserId } from './utils';
import { getCognitoIdToken } from './auth';

const NOTIFLY_LOG_EVENT_URL = 'https://12lnng07q2.execute-api.ap-northeast-2.amazonaws.com/prod/records';

/**
 * Logs an event to Notifly for the current user.
 *
 * @async
 * @param {string} eventName - The name of the event to log.
 * @param {Object} eventParams - The parameters to include in the event log.
 * @param {string[]} [segmentation_event_param_keys=null] - The segmentation event parameter keys.
 * @param {boolean} [isInternalEvent=false] - A flag indicating whether the event is for Notifly internal use.
 * @returns {Promise<void>} A promise that resolves when the event has been logged, or rejects with an error.
 *
 * @example
 * await logEvent('button_clicked', { 'button_name': 'myButton' });
 */
export default async function logEvent(
    eventName,
    eventParams,
    segmentation_event_param_keys = null,
    isInternalEvent = false
) {
    if (!eventName) {
        console.warn('[Notifly] eventName must be provided.');
        return;
    }

    try {
        const [
            cognitoToken,
            notiflyUserId,
            externalUserId,
            prjId,
            externalDeviceId,
            osVersion,
            appVersion,
            deviceToken,
        ] = await Promise.all([
            AsyncStorage.getItem('notiflyCognitoIdToken'),
            getNotiflyUserId(),
            AsyncStorage.getItem('notiflyExternalUserId'),
            AsyncStorage.getItem('notiflyProjectId'),
            rnDeviceInfo.getUniqueId(),
            rnDeviceInfo.getSystemVersion(),
            rnDeviceInfo.getVersion(),
            messaging().getToken(),
        ]);

        const eventId = uuidv5(`${notiflyUserId}${eventName}${new Date().valueOf()}`, NAMESPACE.EVENTID).replace(
            /-/g,
            ''
        );
        const notiflyDeviceId = uuidv5(externalDeviceId, NAMESPACE.DEVICEID).replace(/-/g, '');

        let token = cognitoToken;
        if (!token) {
            const [userName, password] = await Promise.all([
                AsyncStorage.getItem('notiflyUserName'),
                AsyncStorage.getItem('notiflyUserPassword'),
            ]);
            token = await getCognitoIdToken(userName, password);
            await AsyncStorage.setItem('notiflyCognitoIdToken', token);
        }

        if (!token || !notiflyUserId || !prjId || !eventId || !externalDeviceId || !notiflyDeviceId || !deviceToken) {
            const requiredParams = [
                'token',
                'notiflyUserId',
                'prjId',
                'eventId',
                'externalDeviceId',
                'notiflyDeviceId',
                'deviceToken',
            ];
            const missingParam = requiredParams.find((param) => !eval(param));
            throw new Error(`[Notifly] Missing required parameter in logEvent: ${missingParam}`);
        }

        const body = _getBodyForLogEvent(
            notiflyUserId,
            eventId,
            eventName,
            notiflyDeviceId,
            externalDeviceId,
            deviceToken,
            isInternalEvent,
            segmentation_event_param_keys,
            prjId,
            osVersion,
            appVersion,
            externalUserId,
            eventParams
        );
        const requestOptions = _getRequestOptionsForLogEvent(token, body);

        const response = await _apiCall(NOTIFLY_LOG_EVENT_URL, requestOptions);
        const result = JSON.parse(response);

        // If the token is expired, get a new token and retry the logEvent.
        if (result.message == 'The incoming token has expired') {
            const [userName, password] = await Promise.all([
                AsyncStorage.getItem('notiflyUserName'),
                AsyncStorage.getItem('notiflyUserPassword'),
            ]);
            const newToken = await getCognitoIdToken(userName, password);
            await AsyncStorage.setItem('notiflyCognitoIdToken', newToken);
            await logEvent(eventName, eventParams, segmentation_event_param_keys, isInternalEvent);
        }
    } catch (err) {
        console.warn('[Notifly] Failed logging the event. Please retry the initialization. ', err);
    }
}

async function _apiCall(apiUrl, requestOptions) {
    const result = fetch(apiUrl, requestOptions).then((response) => response.text());
    return result;
}

function _getRequestOptionsForLogEvent(token, body) {
    const myHeaders = new Headers();
    myHeaders.append('Authorization', token);
    myHeaders.append('Content-Type', 'application/json');

    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: body,
        redirect: 'follow',
    };
    return requestOptions;
}

function _getBodyForLogEvent(
    notiflyUserId,
    eventId,
    eventName,
    notiflyDeviceId,
    externalDeviceId,
    deviceToken,
    isInternalEvent,
    segmentation_event_param_keys,
    prjId,
    osVersion,
    appVersion,
    externalUserId,
    eventParams
) {
    const eventData = JSON.stringify({
        event_params: eventParams,
        id: eventId,
        name: eventName,
        notifly_user_id: notiflyUserId,
        time: parseInt(new Date().valueOf() / 1000),
        notifly_device_id: notiflyDeviceId,
        external_device_id: externalDeviceId,
        device_token: deviceToken,
        is_internal_event: isInternalEvent,
        segmentation_event_param_keys: segmentation_event_param_keys,
        project_id: prjId,
        platform: Platform.OS,
        os_version: osVersion,
        app_version: appVersion,
        sdk_version: SDK_VERSION,
        external_user_id: externalUserId || undefined,
    });

    const body = JSON.stringify({
        'records': [
            {
                'data': eventData,
                'partitionKey': notiflyUserId,
            },
        ],
    });
    return body;
}
