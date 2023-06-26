export interface EventIntermediateCounts {
    dt: string;
    name: string;
    count: number;
}

export interface UserData {
    // User properties
    user_properties?: Record<string, any>;

    // Device properties
    platform?: string;
    os_version?: string;
    app_version?: string;
    sdk_version?: string;
    sdk_type?: string;
    updated_at?: string; // Not used
}
