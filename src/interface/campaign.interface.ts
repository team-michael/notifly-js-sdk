interface Condition {
    attribute: string;
    event: string;
    event_condition_type: string;
    operator: string;
    secondary_value: number;
    unit: string;
    value: any;
}

interface Campaign {
    channel: string;
    segment_type: string;
    message: {
        html_url: string;
    };
    segment_info?: {
        groups?: {
            conditions?: Condition[];
        }[];
        group_operator?: string;
    };
    triggering_event: string;
    delay: number;
}

export { Campaign, Condition };
