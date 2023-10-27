import type { NotiflyInitializeOptions } from '../Types';

import { APIManager } from '../API/Manager';
import { SessionManager } from './Session';
import { SdkStateManager, SdkState } from './SdkState';
import { EventManager } from './Event/Manager';
import { initializeNotiflyStorage } from '../Utils';

let initializationLock = false;

/**
 * Initializes the Notifly SDK. This should be called as early as possible in your application to function properly.
 * @param {NotiflyInitializeOptions} options - An object containing the project ID, username, password, device token, and push subscription options.
 * @returns {Promise<boolean>} A promise that resolves with a boolean value indicating whether the SDK was initialized successfully.
 */
export async function initialize(options: NotiflyInitializeOptions): Promise<boolean> {
    if (initializationLock) {
        console.warn('[Notifly] Notifly SDK is being initialized more than once. Ignoring this call.');
        return false;
    }
    if (!SdkStateManager.isNotInitialized()) {
        if (SdkStateManager.isReady()) {
            console.warn('[Notifly] Notifly SDK is already initialized. Ignoring this call.');
            return true;
        } else {
            console.error('[Notifly] Encountered unexpected SDK state. Please contact us, contact@greyboxhq.com');
            return false;
        }
    }

    initializationLock = true; // Acquire

    const onInitializationFailed = () => {
        initializationLock = false;
        SdkStateManager.state = SdkState.FAILED;
        return false;
    };
    const onInitializationSuccess = () => {
        initializationLock = false;
        SdkStateManager.state = SdkState.READY;
        return true;
    };

    const { projectId, username, password, deviceToken, sessionDuration, pushSubscriptionOptions } = options;

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
        await initializeNotiflyStorage(projectId, username, password, deviceToken);
        await APIManager.initialize();
        await SessionManager.initialize(pushSubscriptionOptions, sessionDuration);

        return onInitializationSuccess();
    } catch (error) {
        console.error('[Notifly] Error initializing SDK: ', error);
        return onInitializationFailed();
    }
}

/**
 * @param {string} eventName - The name of the event to track.
 * @param {Record<string, any>} eventParams - An object containing the event parameters corresponding to the provided event.
 * @param {string[]} segmentationEventParamKeys - An array of event parameter keys to track as segmentation parameters.
 * @returns {Promise<void>}
 */
export function trackEvent(
    eventName: string,
    eventParams: Record<string, any>,
    segmentationEventParamKeys: string[] | null = null
): Promise<void> {
    return EventManager.logEvent(eventName, eventParams, segmentationEventParamKeys, false);
}

// Function below is only for cafe24 scripts
export function setSdkType(sdkType: 'js' | 'js-cafe24') {
    SdkStateManager.setSdkType(sdkType);
}

export function setSource(source: 'cafe24' | null) {
    SdkStateManager.setSource(source);
}
