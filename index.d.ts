declare module 'notifly-js-sdk-dev' {
    interface NotiflySDK {
        initialize(apiKey: string, options?: any): boolean;
        trackEvent(eventName: string, eventProperties?: any, options?: any): void;
        setUserProperties(userProperties: any, options?: any): void;
        removeUserId(): void;
        setUserId(userId: string, options?: any): void;
        getNotiflyUserID(deviceToken: string): string;
    }
    const notifly: NotiflySDK;
    export default notifly;
}
