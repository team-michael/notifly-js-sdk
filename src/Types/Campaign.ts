export type SegmentConditionUnitType = 'user' | 'device' | 'event';
export type SegmentConditionValueType = 'INT' | 'TEXT' | 'BOOL';
export type GroupOperator = 'OR' | null;
export type ConditionOperator = 'AND' | null;
export type SegmentOperator = '=' | '<>' | '>' | '>=' | '<' | '<=' | '@>';
export type EventBasedConditionType = 'count X' | 'count X in Y days';

export interface Condition {
    unit: SegmentConditionUnitType;
    operator: SegmentOperator;
    value: any;
    attribute?: string;
    event?: string;
    event_condition_type?: EventBasedConditionType;
    secondary_value?: number;
    valueType?: SegmentConditionValueType;
    comparison_parameter?: string;
    useEventParamsAsConditionValue?: boolean;
}

export interface Campaign {
    id: string;
    channel: string;
    last_updated_timestamp: number;
    segment_type: string;
    testing?: boolean;
    whitelist?: string[];
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
