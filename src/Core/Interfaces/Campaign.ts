export type SegmentConditionUnitType = 'user' | 'user_metadata' | 'device' | 'event';
export type ValueType = 'INT' | 'TEXT' | 'BOOL';
export type GroupOperator = 'OR' | null;
export type ConditionOperator = 'AND' | null;
export type Operator = '=' | '<>' | '>' | '>=' | '<' | '<=' | '@>' | 'IS_NULL' | 'IS_NOT_NULL';
export type EventBasedConditionType = 'count X' | 'count X in Y days';

export interface Condition {
    unit: SegmentConditionUnitType;
    operator: Operator;
    value: any;
    attribute?: string;
    event?: string;
    event_condition_type?: EventBasedConditionType;
    secondary_value?: number;
    valueType?: ValueType;
    comparison_parameter?: string;
    useEventParamsAsConditionValue?: boolean;
}

export interface TriggeringEventFilterUnit {
    key: string;
    operator: Operator;
    value?: any;
    value_type?: ValueType;
}
export type TriggeringEventFilter = TriggeringEventFilterUnit[];
export type TriggeringEventFilters = TriggeringEventFilter[];

export interface ReEligibleCondition {
    unit: string;
    value: number;
    max_count?: number;
}

export interface Campaign {
    id: string;
    channel: string;
    last_updated_timestamp: number;
    segment_type: string;
    testing?: boolean;
    whitelist?: string[];
    re_eligible_condition?: ReEligibleCondition;
    message: {
        html_url: string;
        modal_properties: {
            template_name: string;
            width?: string | number;
            height?: string | number;
            zIndex?: string | number;
            position?: string;
            bottom?: string | number;
            right?: string | number;
            left?: string | number;
            top?: string | number;
            center?: boolean;
            padding?: string | number;
            background?: boolean;
            backgroundOpacity?: number;
            small_screen_width_full?: boolean;
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
    triggering_event_filters?: TriggeringEventFilter[];
    delay?: number;
}
