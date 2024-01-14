/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NotiflyInitializeOptions } from './Core/Interfaces/Options';
import {
    SetUserIdCommand,
    SetUserPropertiesCommand,
    TrackEventCommand,
    RemoveUserIdCommand,
    GetUserIdCommand,
    getUserPropertiesCommand,
    RequestPermissonCommand,
} from './Core/Interfaces/Command';

import { CommandDispatcher } from './Core/CommandDispatcher';
import { NotiflyAPI } from './Core/API';
import { SdkStateManager, SdkState } from './Core/SdkState';
import { SessionManager } from './Core/Session';
import { UserStateManager } from './Core/User/State';
import { initializeNotiflyStorage } from './Core/Utils';

let initSemaphore = false;

/**
 * Initializes the Notifly SDK. This should be called as early as possible in your application to function properly.
 * @param {NotiflyInitializeOptions} options - An object containing the project ID, username, password, device token, and push subscription options.
 * @returns {Promise<boolean>} A promise that resolves with a boolean value indicating whether the SDK was initialized successfully.
 */
export async function initialize(options: NotiflyInitializeOptions): Promise<boolean> {
    if (initSemaphore) {
        console.warn('[Notifly] Notifly SDK is being initialized more than once. Ignoring this call.');
        return false;
    }
    if (SdkStateManager.state !== SdkState.NOT_INITIALIZED) {
        if (SdkStateManager.state === SdkState.READY || SdkStateManager.state === SdkState.REFRESHING) {
            console.warn('[Notifly] Notifly SDK is already initialized. Ignoring this call.');
            return true;
        } else {
            console.error(`[Notifly] Encountered unexpected SDK state: ${SdkStateManager.state}`);
            return false;
        }
    }

    initSemaphore = true; // Acquire

    const onInitializationFailed = () => {
        initSemaphore = false;
        SdkStateManager.state = SdkState.FAILED;
        return false;
    };
    const onInitializationSuccess = () => {
        initSemaphore = false;
        SdkStateManager.state = SdkState.READY;
        return true;
    };

    const { projectId, username, password } = options;

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
        await initializeNotiflyStorage(projectId, username, password);
        await NotiflyAPI.initialize();
        UserStateManager.initialize();
        await SessionManager.initialize();
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
export async function trackEvent(
    eventName: string,
    eventParams: Record<string, any>,
    segmentationEventParamKeys: string[] | null = null
): Promise<void> {
    try {
        await CommandDispatcher.getInstance().dispatch(
            new TrackEventCommand({
                eventName,
                eventParams,
                segmentationEventParamKeys,
            })
        );
    } catch (error) {
        console.error('[Notifly] Error tracking event: ', error);
    }
}

/**
 * Sets or removes user ID for the current user.
 *
 * @async
 * @param {string | null | undefined} params - A nullable, optional string containing the user ID to set.
 * @returns {Promise<void>}
 * @summary If the user ID is null or undefined, the user ID will be removed. Otherwise, the user ID will be set to the provided value.
 *
 * @example
 * await setUserId('myUserID') // Sets the user ID to 'myUserID'
 * await setUserId(null) // Removes the user ID
 * await setUserId() // Removes the user ID
 */
export async function setUserId(userId?: string | null | undefined): Promise<void> {
    try {
        await CommandDispatcher.getInstance().dispatch(
            new SetUserIdCommand({
                userId: userId,
            })
        );
    } catch (error) {
        SdkStateManager.state = SdkState.FAILED;
        console.error('[Notifly] Error setting user ID: ', error);
    }
}

/**
 * Sets user properties for the current user.
 *
 * @async
 * @param {Record<string, any>} params - An object containing the user properties to set.
 * @returns {Promise<void>}
 *
 * @example
 * await setUserProperties({ external_user_id: 'myUserID' });
 */
export async function setUserProperties(params: Record<string, any>): Promise<void> {
    try {
        await CommandDispatcher.getInstance().dispatch(
            new SetUserPropertiesCommand({
                params,
            })
        );
    } catch (error) {
        console.error('[Notifly] Error setting user properties: ', error);
    }
}

/**
 * Gets the current user ID.
 *
 * @async
 * @returns {Promise<string | null>}
 *
 * @example
 * const currentUserId = await getUserId();
 */
export async function getUserId(): Promise<string | null> {
    return await CommandDispatcher.getInstance().dispatch(new GetUserIdCommand());
}

/**
 * Gets the user properties for the current user.
 * @async
 * @returns {Promise<Record<string, any> | null>}
 */
export async function getUserProperties(): Promise<Record<string, any> | null> {
    return await CommandDispatcher.getInstance().dispatch(new getUserPropertiesCommand());
}

/**
 * Removes the external user ID and Notifly user ID from localForage.
 *
 * @async
 * @returns {Promise<void>}
 *
 * @example
 * await removeUserId();
 */
export async function removeUserId(): Promise<void> {
    try {
        await CommandDispatcher.getInstance().dispatch(new RemoveUserIdCommand());
    } catch (error) {
        SdkStateManager.state = SdkState.FAILED;
        console.error('[Notifly] Failed to remove userID');
    }
}

export function requestPermisson(): void {
    CommandDispatcher.getInstance()
        .dispatch(new RequestPermissonCommand())
        .catch((error) => {
            console.error('[Notifly] Failed to request permission', error);
        });
}

// Function below is only for cafe24 scripts
export function setSdkType(sdkType: 'js' | 'js-cafe24') {
    SdkStateManager.setSdkType(sdkType);
}

export function setSource(source: 'cafe24' | null) {
    SdkStateManager.setSource(source);
}
