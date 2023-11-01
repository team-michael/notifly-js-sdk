export interface SetUserIdCommandParams {
    userId: string | null | undefined;
}

export interface SetUserPropertiesCommandParams {
    params: Record<string, any>;
}

export interface TrackEventCommandParams {
    eventName: string;
    eventParams: Record<string, any>;
    segmentationEventParamKeys: string[] | null;
}
