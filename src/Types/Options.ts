/**
 * @typedef {Object} NotiflyInitializeOptions
 * @property {string} projectId - The project ID of the Notifly project.
 * @property {string} username - Username to authorize Notifly project.
 * @property {string} password - Password to authorize Notifly project.
 * @property {number?} sessionDuration - The duration of the session in seconds. Defaults to 1800 seconds (30 minutes).
 * @property {string?} deviceToken - The device token of the current device.
 * @property {NotiflyPushSubscriptionOptions?} pushSubscriptionOptions - An object containing the web-push subscription options.
 */
export type NotiflyInitializeOptions = {
    projectId: string;
    username: string;
    password: string;
    sessionDuration?: number;
    deviceToken?: string;
    pushSubscriptionOptions?: NotiflyPushSubscriptionOptions;
};

/**
 * @typedef {Object} NotiflyPushSubscriptionOptions
 * @property {string} vapidPublicKey - The VAPID public key to use for web-push subscriptions.
 * @property {boolean?} askPermission - A boolean value indicating whether to ask the user for permission to send push notifications. Defaults to true.
 * @property {string?} serviceWorkerPath - The path to the service worker file. Defaults to '/service-worker.js'.
 * @property {number?} promptDelayMillis - The number of milliseconds to wait before prompting the user for asking permission to send push notifications. Defaults to 5000.
 */
export type NotiflyPushSubscriptionOptions = {
    vapidPublicKey: string;
    askPermission?: boolean;
    serviceWorkerPath?: string;
    promptDelayMillis?: number;
};
