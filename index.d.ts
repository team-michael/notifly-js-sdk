declare module 'notifly-js-sdk' {
    interface NotiflySDK {
        initialize(projectID: string | null | undefined, userName: string | null | undefined, password: string | null | undefined, deviceToken: string | null | undefined): boolean;
        trackEvent(
            eventName: string,
            eventParams: Record<string, any>,
            segmentationEventParamKeys?: string[] | null | undefined
        ): void;
        setUserProperties(userProperties: Record<string, any>): void;
        removeUserId(): void;
        setUserId(userId?: string | null | undefined): void;
        setDeviceToken(deviceToken: string | null | undefined): void;
        registerServiceWorker(vapid_public_key: string, path: string): void;
    }
    const notifly: NotiflySDK;
    export default notifly;
}
