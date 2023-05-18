import { v4 } from 'uuid';
import { SDK_VERSION } from './constants';
import { saveCognitoIdToken } from './auth';
import { generateNotiflyUserID, getPlatform } from './utils';

const NOTIFLY_LOG_EVENT_URL = 'https://12lnng07q2.execute-api.ap-northeast-2.amazonaws.com/prod/records';

async function logEvent(
    eventName: string,
    eventParams: Record<string, any>,
    segmentation_event_param_keys: string[] | null = null,
    isInternalEvent = false,
    retryCount = 1
): Promise<void> {
    const [projectID, deviceToken, cognitoIDToken, notiflyDeviceID, externalUserID] = [
        localStorage.getItem('__notiflyProjectID'),
        localStorage.getItem('__notiflyDeviceToken'),
        localStorage.getItem('__notiflyCognitoIDToken') || '',
        localStorage.getItem('__notiflyDeviceID'),
        localStorage.getItem('__notiflyExternalUserID'),
    ];
    let notiflyUserID = localStorage.getItem('__notiflyUserID');
    if (!notiflyUserID) {
        // Use generateNotiflyUserID to not call localStorage again
        if (externalUserID) {
            notiflyUserID = generateNotiflyUserID(externalUserID, undefined) || null;
        } else if (deviceToken) {
            notiflyUserID = generateNotiflyUserID(undefined, deviceToken) || null;
        }
    }

    const data = JSON.stringify({
        id: v4().replace(/-/g, ''),
        project_id: projectID,
        name: eventName,
        event_params: eventParams,
        notifly_device_id: notiflyDeviceID,
        notifly_user_id: notiflyUserID,
        external_user_id: externalUserID,
        device_token: deviceToken,
        is_internal_event: isInternalEvent,
        segmentation_event_param_keys: segmentation_event_param_keys,
        sdk_version: SDK_VERSION,
        time: new Date().valueOf() / 1000,
        platform: getPlatform(),
    });

    const body = JSON.stringify({
        'records': [
            {
                'data': data,
                'partitionKey': notiflyUserID,
            },
        ],
    });
    const requestOptions = _getRequestOptionsForLogEvent(cognitoIDToken, body);
    const response = await _apiCall(NOTIFLY_LOG_EVENT_URL, requestOptions);
    const result = JSON.parse(response);

    // If the token is expired, get a new token and retry the logEvent.
    if (result.message == 'The incoming token has expired' && retryCount) {
        const [userName, password] = [
            localStorage.getItem('__notiflyUserName') || '',
            localStorage.getItem('__notiflyPassword') || '',
        ];
        await saveCognitoIdToken(userName, password);
        await logEvent(eventName, eventParams, segmentation_event_param_keys, isInternalEvent, 0);
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

async function _apiCall(apiUrl: string, requestOptions: RequestInit): Promise<string> {
    const result = fetch(apiUrl, requestOptions).then((response) => response.text());
    return result;
}

async function sessionStart(): Promise<void> {
    return await logEvent('session_start', {}, null, true);
}

export { logEvent, sessionStart };
