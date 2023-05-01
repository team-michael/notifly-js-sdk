import { v4, v5 } from 'uuid';
import { SDK_VERSION, NAMESPACE } from './constants';
import { saveCognitoIdToken } from './auth';

const NOTIFLY_LOG_EVENT_URL = 'https://12lnng07q2.execute-api.ap-northeast-2.amazonaws.com/prod/records';

function getNotiflyUserID(deviceToken: any) {
    const externalUserID = localStorage.getItem('__notiflyExternalUserID');
    if (externalUserID) {
        return v5(externalUserID, NAMESPACE.REGISTERED_USERID).replace(/-/g, '');
    }
    return v5(deviceToken, NAMESPACE.UNREGISTERED_USERID).replace(/-/g, '');
}

async function logEvent(
    eventName: any,
    eventParams: any,
    segmentation_event_param_keys = null,
    isInternalEvent = false,
    retryCount = 1
) {
    const [projectID, deviceToken, cognitoIDToken, notiflyDeviceID, externalUserID] = [
        localStorage.getItem('__notiflyProjectID'),
        localStorage.getItem('__notiflyDeviceToken'),
        localStorage.getItem('__notiflyCognitoIDToken'),
        localStorage.getItem('__notiflyDeviceID'),
        localStorage.getItem('__notiflyExternalUserID'),
    ];
    const notiflyUserID = getNotiflyUserID(deviceToken);
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
        // @ts-expect-error TS(2345): Argument of type 'number' is not assignable to par... Remove this comment to see the full error message
        time: parseInt(new Date().valueOf() / 1000),
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
            localStorage.getItem('__notiflyUserName'),
            localStorage.getItem('__notiflyPassword'),
        ];
        await saveCognitoIdToken(userName, password);
        await logEvent(eventName, eventParams, segmentation_event_param_keys, isInternalEvent, 0);
    }
}

function _getRequestOptionsForLogEvent(token: any, body: any) {
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

async function _apiCall(apiUrl: any, requestOptions: any) {
    const result = fetch(apiUrl, requestOptions).then((response) => response.text());
    return result;
}

function getPlatform() {
    const userAgent = navigator.userAgent;

    if (/iPad|iPhone|iPod/.test(userAgent)) {
        return 'ios';
    } else if (/Android/.test(userAgent)) {
        return 'android';
    } else if (/webOS|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|Firefox|Chrome/.test(userAgent)) {
        return 'web';
    } else {
        return 'unknown';
    }
}

async function sessionStart() {
    return await logEvent('session_start', {}, null, true);
}

export {
    logEvent,
    sessionStart,
    getNotiflyUserID,
};
