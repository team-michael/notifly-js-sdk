/* eslint-disable @typescript-eslint/no-explicit-any */
export interface DeviceProperties {
    platform?: string;
    os_version?: string;
    app_version?: string;
    sdk_version?: string;
    sdk_type?: string;
    updated_at?: string; // Not used
}

export interface UserProperties {
    user_properties?: Record<string, any>;
}

export interface CampaignHiddenUntil {
    campaign_hidden_until?: Record<string, any>;
}

export interface UserMetadataProperties {
    external_user_id?: string | null;
}

export interface EventIntermediateCounts {
    dt: string;
    name: string;
    count: number;
    event_params: Record<string, any>;
}

export type UserData = DeviceProperties & UserProperties & UserMetadataProperties & CampaignHiddenUntil;
