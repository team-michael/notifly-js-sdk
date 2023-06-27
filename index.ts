import localForage from './src/localforage';

import type { NotiflyInitializeOptions } from './src/types';
import { logEvent, sessionStart } from './src/logEvent';
import { saveCognitoIdToken } from './src/auth';
import { setUserId, setUserProperties, deleteUser } from './src/user';
import { getNotiflyUserID, getNotiflyDeviceID } from './src/utils';
import { setDeviceToken } from './src/device';
import { syncState } from './src/state';
import { registerServiceWorker } from './src/push';

let initializationLock = false;
let isNotiflyInitialized = false;

/**
 * Initializes the Notifly SDK. This should be called as early as possible in your application to function properly.
 * @param {NotiflyInitializeOptions} options - An object containing the project ID, username, password, device token, and push subscription options.
 * @returns {Promise<boolean>} A promise that resolves with a boolean value indicating whether the SDK was initialized successfully.
 */
async function initialize(options: NotiflyInitializeOptions): Promise<boolean> {
    if (initializationLock) {
        console.warn('[Notifly] Notifly SDK is being initialized more than once. Ignoring this call.');
        return false;
    }
    if (isNotiflyInitialized) {
        console.warn('[Notifly] Notifly SDK is already initialized. Ignoring this call.');
        return true;
    }

    initializationLock = true;

    const onInitializationFailed = () => {
        initializationLock = false;
        isNotiflyInitialized = false;
        return false;
    };
    const onInitializationSuccess = () => {
        initializationLock = false;
        isNotiflyInitialized = true;
        return true;
    };

    const { projectId, username, password, deviceToken, pushSubscriptionOptions } = options;

    if (!(projectId && username && password)) {
        console.error('[Notifly] projectID, userName and password must not be empty');
        return onInitializationFailed();
    }

    if (typeof window === 'undefined') {
        console.error(
            '[Notifly] The SDK requires a browser environment to function properly. Please ensure that you are using the SDK within a supported browser environment.'
        );
        return onInitializationFailed();
    }

    try {
        const [notiflyUserID, notiflyDeviceID] = await Promise.all([
            getNotiflyUserID(projectId, undefined, deviceToken),
            getNotiflyDeviceID(deviceToken),
            saveCognitoIdToken(username, password),
        ]);
        await _saveNotiflyData({
            __notiflyProjectID: projectId,
            __notiflyUserName: username,
            __notiflyPassword: password,
            __notiflyDeviceID: notiflyDeviceID,
            __notiflyUserID: notiflyUserID,
            ...(deviceToken !== null && deviceToken !== undefined && { __notiflyDeviceToken: deviceToken }),
        });

        if (pushSubscriptionOptions) {
            const { vapidPublicKey, askPermission, serviceWorkerPath, promptDelayMillis } = pushSubscriptionOptions;
            await registerServiceWorker(vapidPublicKey, askPermission, serviceWorkerPath, promptDelayMillis);
        }
        await syncState(projectId, notiflyUserID, notiflyDeviceID);
        await sessionStart();

        return onInitializationSuccess();
    } catch (error) {
        console.error('[Notifly] Error initializing SDK: ', error);
        return onInitializationFailed();
    }
}

async function _saveNotiflyData(data: Record<string, string>): Promise<void> {
    const promises = Object.entries(data).map(([key, val]) => {
        return localForage.setItem(key, val as string);
    });

    await Promise.all(promises);
}

/**
 * @param {string} eventName - The name of the event to track.
 * @param {Record<string, any>} eventParams - An object containing the event parameters corresponding to the provided event.
 * @param {string[]} segmentationEventParamKeys - An array of event parameter keys to track as segmentation parameters.
 * @returns {Promise<void>}
 */
function trackEvent(
    eventName: string,
    eventParams: Record<string, any>,
    segmentationEventParamKeys: string[] | null = null
): Promise<void> {
    return logEvent(eventName, eventParams, segmentationEventParamKeys, false);
}

const notifly = {
    initialize,
    trackEvent,
    setUserProperties,
    deleteUser,
    setUserId,
    setDeviceToken,
    // For testing purposes only
    resetInitialization: () => {
        initializationLock = false;
        isNotiflyInitialized = false;
    },
};

// Check if the code is running in a browser environment before assigning to `window`
if (typeof window !== 'undefined') {
    (window as any).notifly = notifly;
}

export default notifly;
