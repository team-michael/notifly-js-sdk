declare module 'notifly-js-sdk' {
    type NotiflyPushSubscriptionOptions = {
        vapidPublicKey: string;
        askPermission?: boolean;
        serviceWorkerPath?: string;
        promptDelayMillis?: number;
    };

    type NotiflyInitializeOptions = {
        projectId: string;
        username: string;
        password: string;
        deviceToken?: string;
        pushSubscriptionOptions?: NotiflyPushSubscriptionOptions;
    };

    interface NotiflySDK {
        initialize(options: NotiflyInitializeOptions): boolean;
        trackEvent(
            eventName: string,
            eventParams: Record<string, any>,
            segmentationEventParamKeys?: string[] | null | undefined
        ): void;
        setUserProperties(userProperties: Record<string, any>): void;
        deleteUser(): void;
        setUserId(userId?: string | null | undefined): void;
        setDeviceToken(deviceToken: string | null | undefined): void;
        setSdkType(sdkType: 'js' | 'js-cafe24'): void;
        setSource(source: 'cafe24' | null): void;
    }

    const notifly: NotiflySDK;

    export default notifly;
}
