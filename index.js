import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import logEvent from './src/log_event';
import { setUserProperties, removeUserId } from './src/user';
import { clickHandler, sessionStart } from './src/utils';
let isSetBackgroundHandler = false;
exports.trackEvent = logEvent;
exports.setUserProperties = setUserProperties;
exports.clickHandler = clickHandler;

/**
 * Sets the background message handler for the Notifly SDK.
 * This method should be called in the index.js file of your app.
 * Should be used when you don't have a custom background message handler.
 * @returns {Promise<void>} - A promise that resolves when the background message handler is set.
 * @example
 * setNotiflyBackgroundMessageHandler();
*/
async function setNotiflyBackgroundMessageHandler() {
    messaging().setBackgroundMessageHandler(notiflyBackgroundHandler);
}

/**
 * The background message handler for the Notifly SDK.
 * This method should be called in the index.js file of your app.
 * Should be used when you have a custom background message handler.
 * @param {Object} remoteMessage - The remote message to handle.
 * @returns {Promise<void>} - A promise that resolves when the background message handler is set.
 * @example
 * messaging().setBackgroundMessageHandler(async remoteMessage => {
       console.log('Existing handler: Background message received:', remoteMessage);
       await notiflyBackgroundHandler(remoteMessage);
    });
*/
async function notiflyBackgroundHandler(remoteMessage) {
    if (!remoteMessage.notification) {
        return; // TODO(minyong): Discuss if we should log only when notifly_message_type is push-notitification.
    }
    if (!isSetBackgroundHandler) {
        await logEvent(
            'push_delivered',
            {
                type: 'message_event',
                channel: 'push-notification',
                campaign_id: remoteMessage?.data?.campaign_id,
                notifly_message_id: remoteMessage?.data?.notifly_message_id,
                status: 'quit',
            },
            null,
            true,
        );
        isSetBackgroundHandler = true;
        return;
    }
    await logEvent(
        'push_delivered',
        {
            type: 'message_event',
            channel: 'push-notification',
            campaign_id: remoteMessage?.data?.campaign_id,
            notifly_message_id: remoteMessage.data?.notifly_message_id,
            status: 'background',
        },
        null,
        true,
    );
}

/**
 * Sets the external user ID for the user.
 *
 * @async
 * @param {string} userID - The external user ID for the user.
 * @returns {Promise<void>} - A promise that resolves when the user ID is set.
 *
 * @example
 * await setUserId('123456789');
 */
exports.setUserId = async function (userID) {
    try {
        if (userID) {
            await setUserProperties({
                external_user_id: userID,
            });
            return;
        }
        await removeUserId();
        return;
    } catch (err) {
        console.warn('[Notifly] setUserId failed.');
    }
};

/**
 * Initializes the Notifly SDK with the given project ID, user name, and password.
 *
 * @async
 * @param {string} prjId - The project ID to use for initialization.
 * @param {string} userName - The user name to use for authentication.
 * @param {string} password - The password to use for authentication.
 * @param {boolean} [useCustomClickHandler=false] - A flag indicating whether to use a custom click handler for push notifications.
 * @returns {Promise<void>} A promise that resolves when initialization is complete, or rejects with an error.
 *
 * @example
 * await initialize('myProjectId', 'myUserName', 'myPassword');
 */
exports.initialize = async function (prjId, userName, password, useCustomClickHandler = false) {
    try {
        await messaging().requestPermission();

        // push
        messaging().onNotificationOpenedApp(handleNotificationOpened);

        // custom push click handler
        if (!useCustomClickHandler) {
            const initialNotification = await messaging().getInitialNotification();
            if (initialNotification) {
                await clickHandler(initialNotification);
            }
        }

        messaging().getToken();
        messaging().setDeliveryMetricsExportToBigQuery(true);

        await Promise.all([
            AsyncStorage.setItem('notiflyProjectId', prjId),
            AsyncStorage.setItem('notiflyUserName', userName),
            AsyncStorage.setItem('notiflyUserPassword', password),
        ]);
        await sessionStart();
    } catch (err) {
        console.warn('[Notifly]: ', err);
    }
};


async function handleNotificationOpened(remoteMessage) {
    try {
        const link = remoteMessage.data?.link;
        if (link) {
            Linking.openURL(link);
        }
        await logEvent(
            'push_click',
            {
                type: 'message_event',
                channel: 'push-notification',
                campaign_id: remoteMessage.data.campaign_id,
                notifly_message_id: remoteMessage.data?.notifly_message_id,
                status: 'background',
            },
            null,
            true
        );
    } catch (err) {
        console.warn('[Notifly] Notification opened handling failed:', err);
    }
}

exports.setNotiflyBackgroundMessageHandler = setNotiflyBackgroundMessageHandler;
exports.notiflyBackgroundHandler = notiflyBackgroundHandler;
