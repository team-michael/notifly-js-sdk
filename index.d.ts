declare module 'notifly-js-sdk-dev' {
    interface NotiflySDK {
        initialize(projectID: string | null, userName: string | null, password: string | null, deviceToken: string | null): boolean;
        trackEvent(
            eventName: string,
            eventParams: Record<string, any>,
            segmentation_event_param_keys?: string[] | null,
            isInternalEvent?: boolean,
            retryCount?: number
        ): void;
        setUserProperties(userProperties: Record<string, any>): void;
        removeUserId(): void;
        setUserId(userId?: string | null): void;
    }
    const notifly: NotiflySDK;
    export default notifly;
}
