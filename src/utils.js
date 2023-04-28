import { Platform, Linking } from 'react-native';
import rnDeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { v5 as uuidv5 } from 'uuid';
import { NAMESPACE } from './constant';
import logEvent from './log_event';

/**
 * Gets the Notifly user ID for the current user.
 *
 * @async
 * @returns {Promise<string>} A promise that resolves with the Notifly user ID, or rejects with an error.
 *
 * @example
 * const notiflyUserId = await getNotiflyUserId();
 */
export async function getNotiflyUserId() {
    const encodedUserId = await AsyncStorage.getItem('notiflyUserId');
    if (encodedUserId) {
        return encodedUserId;
    }
    const [prjId, externalUserId] = await Promise.all([
        AsyncStorage.getItem('notiflyProjectId'),
        AsyncStorage.getItem('notiflyExternalUserId'),
    ]);
    let notiflyUserId;
    if (externalUserId) {
        notiflyUserId = uuidv5(`${prjId}${externalUserId}`, NAMESPACE.REGISTERED_USERID).replace(/-/g, '');
    } else {
        notiflyUserId = uuidv5(`${prjId}${await messaging().getToken()}`, NAMESPACE.UNREGISTERED_USERID).replace(
            /-/g,
            ''
        );
    }
    return notiflyUserId;
}

/**
 * Logs a 'session_start' event with device information.
 *
 * @async
 * @returns {Promise<void>} A promise that resolves when the event is logged, or rejects with an error.
 *
 * @example
 * await sessionStart();
 */
export async function sessionStart() {
    const platform = Platform.OS;
    const apiLevelPromise = rnDeviceInfo.getApiLevel();
    const brandPromise = rnDeviceInfo.getBrand();
    const modelPromise = rnDeviceInfo.getModel();
    const userAgentPromise = rnDeviceInfo.getUserAgent();

    const [deviceModel, deviceBrand, apiLevel, userAgent] = await Promise.all([
        modelPromise,
        brandPromise,
        apiLevelPromise,
        userAgentPromise,
    ]);

    const openAppEventParams = {
        platform,
        type: 'session_start_event',
        device_model: deviceModel,
        properties: {
            device_brand: deviceBrand,
            api_level: apiLevel,
            user_agent: userAgent,
        },
    };
    await logEvent('session_start', openAppEventParams, null, true);
}

/**
 * Handles a click event on a push notification.
 *
 * @async
 * @function
 * @param {Object} remoteMessage - The remote message object containing the notification data.
 * @returns {Promise<void>} - A promise that resolves when the click event is handled.
 *
 * @example
 * // Usage:
 * const remoteMessage = {
 *     data: {
 *         link: 'https://example.com',
 *         campaign_id: '1234'
 *     }
 * };
 * await clickHandler(remoteMessage);
 */
export async function clickHandler(remoteMessage) {
    if (!remoteMessage) {
        console.warn('[Notifly] clickHandler receives a null remoteMessage.');
        return;
    }

    try {
        const { data: { link, campaign_id, notifly_message_id } = {} } = remoteMessage;

        if (link) {
            Linking.openURL(link);
        }
        await logEvent(
            'push_click',
            { channel: 'push-notification', type: 'message_event', campaign_id, notifly_message_id, status: 'quit' },
            null,
            true
        );
    } catch (err) {
        console.warn('[Notifly] custom click handler registration failed.');
    }
}

// React Native does not support Buffer out of the box, so we need to implement our own base64 decoder.
export function base64Decode(input) {
    const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = '';
    let output = '';

    for (let i = 0; i < input.length; i += 4) {
        const encoded1 = chars.indexOf(input[i]);
        const encoded2 = chars.indexOf(input[i + 1]);
        const encoded3 = chars.indexOf(input[i + 2]);
        const encoded4 = chars.indexOf(input[i + 3]);

        const decoded1 = (encoded1 << 2) | (encoded2 >> 4);
        const decoded2 = ((encoded2 & 15) << 4) | (encoded3 >> 2);
        const decoded3 = ((encoded3 & 3) << 6) | encoded4;

        output += String.fromCharCode(decoded1);
        if (encoded3 !== 64) output += String.fromCharCode(decoded2);
        if (encoded4 !== 64) output += String.fromCharCode(decoded3);
    }

    return output;
}
