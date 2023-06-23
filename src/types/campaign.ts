type GroupOperator = 'OR' | null;
type ConditionOperator = 'AND' | null;

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
    last_updated_timestamp: number;
    segment_type: string;
    message: {
        html_url: string;
        modal_properties: {
            template_name: string;
            width?: string | number;
            height?: string | number;
            zIndex?: string | number;
            position?: string;
            bottom?: string | number;
            top?: string | number;
        };
    };
    segment_info?: {
        groups?: {
            conditions?: Condition[];
            condition_operator: ConditionOperator;
        }[];
        group_operator: GroupOperator;
    };
    triggering_event: string;
    delay?: number;
}
