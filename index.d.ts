declare module 'notifly-js-sdk-dev' {
    export function initialize(apiKey: string, options?: any): boolean;
    export function trackEvent(eventName: string, eventProperties?: any, options?: any): void;
    export function setUserProperties(userProperties: any, options?: any): void;
    export function removeUserId(): void;
    export function setUserId(userId: string, options?: any): void;
    export function getNotiflyUserID(deviceToken: string): string;
}
