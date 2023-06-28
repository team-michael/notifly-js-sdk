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

export interface EventIntermediateCounts {
    dt: string;
    name: string;
    count: number;
    event_params: Record<string, any>;
}

export type UserData = DeviceProperties & UserProperties;
