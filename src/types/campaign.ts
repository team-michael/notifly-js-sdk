export interface Condition {
    attribute: string;
    event: string;
    event_condition_type: string;
    operator: string;
    secondary_value: number;
    unit: string;
    value: any;
}

export interface Campaign {
    id: string;
    channel: string;
    segment_type: string;
    message: {
        html_url: string;
        modal_properties: { template_name: string };
    };
    segment_info?: {
        groups?: {
            conditions?: Condition[];
        }[];
        group_operator?: string;
    };
    triggering_event: string;
    delay?: number;
    status: number;
}
