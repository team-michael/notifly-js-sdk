/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NotiflyInitializeOptions, SetUserIdOptions } from './Core/Interfaces/Options';
import {
    SetUserIdCommand,
    SetUserPropertiesCommand,
    TrackEventCommand,
    RemoveUserIdCommand,
    GetUserIdCommand,
    getUserPropertiesCommand,
    RequestPermissionCommand,
} from './Core/Command/Commands';
import { Language } from './Core/Interfaces/RequestPermissionPromptDesignParams';

import { CommandManager } from './Core/Command';
import { NotiflyAPI } from './Core/API';
import { SdkStateManager, SdkState, type SdkType } from './Core/SdkState';
import { SessionManager } from './Core/Session';
import { initializeNotiflyStorage, isValidProjectId, isValidTimezoneId, removeKeys } from './Core/Utils';
import { BuiltInUserPropertyKey } from './Constants';

let initSemaphore = false;

/**
 * @summary Initializes the Notifly SDK. All the other SDK commands will be executed only after the SDK is initialized.
 *
 * @async
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

    if (typeof window === 'undefined') {
        console.error(
            '[Notifly] The SDK requires a browser environment to function properly. Please ensure that you are using the SDK within a supported browser environment.'
        );
        return onInitializationFailed();
    }

    const { projectId, username, password, allowUserSuppliedLogEvent } = options;

    if (!isValidProjectId(projectId)) {
        console.error('[Notifly] Invalid project ID. Please provide a valid project ID.');
        return onInitializationFailed();
    }

    if (!username || !password) {
        console.error('[Notifly] username and password must not be empty');
        return onInitializationFailed();
    }

    SdkStateManager.setAllowUserSuppliedLogEvent(allowUserSuppliedLogEvent);

    window.addEventListener('beforeunload', () => {
        SdkStateManager.state = SdkState.TERMINATED;
    });
    window.addEventListener('pagehide', (event) => {
        if (event.persisted) {
            SdkStateManager.state = SdkState.TERMINATED;
        }
    });

    try {
        await initializeNotiflyStorage(projectId, username, password);
        await NotiflyAPI.initialize();
        await SessionManager.initialize();
        return onInitializationSuccess();
    } catch (error) {
        console.error('[Notifly] Error initializing SDK: ', error);
        return onInitializationFailed();
    }
}

/**
 * @summary Tracks an event with the given name and parameters.
 *
 * @async
 *
 * @example
 * trackEvent('my_event', { key1: 'value1', key2: 'value2' });
 */
export async function trackEvent(
    eventName: string,
    eventParams: Record<string, any> = {},
    segmentationEventParamKeys: string[] | null = null
): Promise<void> {
    if (SdkStateManager.halted) {
        console.warn('[Notifly] SDK has been stopped due to the unrecoverable error or termination. Ignoring...');
        return;
    }
    try {
        await CommandManager.getInstance().dispatch(
            new TrackEventCommand({
                eventName,
                eventParams,
                segmentationEventParamKeys,
            })
        );
    } catch (error) {
        const logger = SdkStateManager.halted ? console.warn : console.error;
        logger('[Notifly] Error tracking event: ', error);
    }
}

/**
 * Sets or removes user ID for the current user.
 *
 * @summary If the user ID is null or undefined, the user ID will be removed. Otherwise, the user ID will be set to the provided value.
 *
 * @async
 *
 * @example
 * setUserId('myUserID') // Sets the user ID to 'myUserID'
 * setUserId(null) // Removes the user ID
 * setUserId() // Removes the user ID
 */
export async function setUserId(userId?: string | null | undefined, options?: SetUserIdOptions): Promise<void> {
    if (SdkStateManager.halted) {
        console.warn('[Notifly] SDK has been stopped due to the unrecoverable error or termination. Ignoring...');
        return;
    }
    try {
        await CommandManager.getInstance().dispatch(
            new SetUserIdCommand({
                userId: userId,
                options: options,
            })
        );
    } catch (error) {
        const logger = SdkStateManager.halted ? console.warn : console.error;
        logger('[Notifly] Error setting user ID: ', error);
    }
}

/**
 * @summary Removes the external user ID and Notifly user ID from localForage.
 *
 * @async
 *
 * @example
 * removeUserId();
 */
export async function removeUserId(options?: SetUserIdOptions): Promise<void> {
    if (SdkStateManager.halted) {
        console.warn('[Notifly] SDK has been stopped due to the unrecoverable error or termination. Ignoring...');
        return;
    }
    try {
        await CommandManager.getInstance().dispatch(
            new RemoveUserIdCommand({
                options: options,
            })
        );
    } catch (error) {
        const logger = SdkStateManager.halted ? console.warn : console.error;
        logger('[Notifly] Error removing user ID: ', error);
    }
}

/**
 * Sets user properties for the current user.
 *
 * @async
 *
 * @example
 * setUserProperties({ name: 'John Doe', age: 42 });
 */
export async function setUserProperties(params: Record<string, any>): Promise<void> {
    if (SdkStateManager.halted) {
        console.warn('[Notifly] SDK has been stopped due to the unrecoverable error or termination. Ignoring...');
        return;
    }

    if (Object.keys(params).length === 0) {
        console.warn('[Notifly] No user properties provided. Ignoring...');
        return;
    }

    const timezone = params[BuiltInUserPropertyKey.TIMEZONE];
    if (timezone && !isValidTimezoneId(timezone)) {
        console.warn('[Notifly] Invalid timezone identifier. Ignoring timezone property.');
        return setUserProperties(removeKeys(params, [BuiltInUserPropertyKey.TIMEZONE]));
    }

    try {
        await CommandManager.getInstance().dispatch(
            new SetUserPropertiesCommand({
                params,
            })
        );
    } catch (error) {
        const logger = SdkStateManager.halted ? console.warn : console.error;
        logger('[Notifly] Error setting user properties: ', error);
    }
}

/**
 * Sets phone number for the current user.
 *
 * @async
 *
 * @example
 * setEmail('team@greyboxhq.com');
 */
export async function setEmail(email: string): Promise<void> {
    if (!email?.trim() || typeof email !== 'string') {
        console.error('[Notifly] Email must be a non-empty string');
        return;
    }
    setUserProperties({
        [BuiltInUserPropertyKey.EMAIL]: email.trim(),
    });
}

/**
 * Sets phone number for the current user.
 *
 * @async
 *
 * @example
 * setPhoneNumber('01012345678');
 */
export async function setPhoneNumber(phoneNumber: string): Promise<void> {
    if (!phoneNumber?.trim() || typeof phoneNumber !== 'string') {
        console.error('[Notifly] Phone number must be a non-empty string');
        return;
    }
    setUserProperties({
        [BuiltInUserPropertyKey.PHONE_NUMBER]: phoneNumber.trim(),
    });
}

/**
 * Sets timezone for the current user.
 * Timezone identifier must be a valid non-empty string.
 *
 * @see
 * https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
 *
 * @param tz - Timezone identifier. e.g. 'Asia/Seoul', 'America/New_York'
 *
 * @async
 *
 * @example
 * setTimezone('Asia/Seoul');
 * setTimezone('America/New_York');
 */
export async function setTimezone(tz: string): Promise<void> {
    if (!tz?.trim() || typeof tz !== 'string') {
        console.error('[Notifly] Timezone identifier must be a non-empty string');
        return;
    }

    const trimmed = tz.trim();
    if (!isValidTimezoneId(trimmed)) {
        console.error('[Notifly] Invalid timezone identifier. Please provide a valid timezone identifier.');
        return;
    }
    setUserProperties({
        [BuiltInUserPropertyKey.TIMEZONE]: trimmed,
    });
}

/**
 * Gets the current user ID.
 *
 * @async
 *
 * @example
 * const currentUserId = await getUserId();
 */
export async function getUserId(): Promise<string | null> {
    if (SdkStateManager.halted) {
        throw new Error('[Notifly] SDK has been stopped due to the unrecoverable error or termination.');
    }
    return await CommandManager.getInstance().dispatch(new GetUserIdCommand());
}

/**
 * Gets the user properties for the current user.
 *
 * @async
 *
 * @example
 * const userProperties = await getUserProperties();
 */
export async function getUserProperties(): Promise<Record<string, any> | null> {
    if (SdkStateManager.halted) {
        throw new Error('[Notifly] SDK has been stopped due to the unrecoverable error or termination.');
    }
    return await CommandManager.getInstance().dispatch(new getUserPropertiesCommand());
}

/**
 * @summary Requests permission from the user to send web push notifications.
 *
 * @async
 *
 * @param languageToForce - The language to force for the permission prompt. If not provided, the browser preferred language will be used. The language should be one of the 'ko', 'en', 'ja', 'zh'
 */
export async function requestPermission(languageToForce?: Language): Promise<void> {
    if (SdkStateManager.halted) {
        console.warn('[Notifly] SDK has been stopped due to the unrecoverable error or termination. Ignoring...');
        return;
    }
    try {
        let sanitizedLanguageToForce: Language | undefined = languageToForce;
        if (typeof languageToForce !== 'undefined' && !Object.values(Language).includes(languageToForce)) {
            console.error(
                '[Notifly] Invalid language provided. Requesting permission with browser preferred language.'
            );
            sanitizedLanguageToForce = undefined;
        }

        await CommandManager.getInstance().dispatch(new RequestPermissionCommand(sanitizedLanguageToForce));
    } catch (error) {
        const logger = SdkStateManager.halted ? console.warn : console.error;
        logger('[Notifly] Failed to request permission', error);
    }
}

export function setSdkType(sdkType: SdkType) {
    SdkStateManager.setSdkType(sdkType);
}

export function getSdkVersion(): string {
    return SdkStateManager.getSdkVersion();
}

export function setSdkVersion(sdkVersion: string) {
    SdkStateManager.setSdkVersion(sdkVersion);
}

// Function below is only for cafe24 scripts
export function setSource(source: 'cafe24' | null) {
    SdkStateManager.setSource(source);
}
