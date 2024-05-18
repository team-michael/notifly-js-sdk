import type { SetUserIdOptions } from '../Interfaces/Options';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SetUserIdCommandParams {
    userId: string | null | undefined;
    options?: SetUserIdOptions;
}

export interface RemoveUserIdCommandParams {
    options?: SetUserIdOptions;
}

export interface SetUserPropertiesCommandParams {
    params: Record<string, any>;
}

export interface TrackEventCommandParams {
    eventName: string;
    eventParams: Record<string, any>;
    segmentationEventParamKeys: string[] | null;
}
