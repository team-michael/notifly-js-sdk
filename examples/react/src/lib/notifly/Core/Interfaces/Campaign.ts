/* eslint-disable @typescript-eslint/no-explicit-any */
export type SegmentConditionUnitType = 'user' | 'user_metadata' | 'device' | 'event';
export type ValueType = 'INT' | 'TEXT' | 'BOOL';
export type GroupOperator = 'OR' | null;
export type ConditionOperator = 'AND' | null;
export type EventBasedConditionType = 'count X' | 'count X in Y days';

export type TriggeringConditionType = 'event_name'; // Currently only event_name is supported
export type TriggeringConditionOperator =
    | '='
    | '!='
    | 'starts_with'
    | 'does_not_start_with'
    | 'ends_with'
    | 'does_not_end_with'
    | 'contains'
    | 'does_not_contain'
    | 'matches_regex'
    | 'does_not_match_regex';

export type Operator = '=' | '<>' | '>' | '>=' | '<' | '<=' | '@>' | 'IS_NULL' | 'IS_NOT_NULL';

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

export interface TriggeringConditionUnit {
    type: TriggeringConditionType;
    operator: TriggeringConditionOperator;
    operand: string;
}
export type TriggeringConditionGroup = TriggeringConditionUnit[];
export type TriggeringConditions = TriggeringConditionGroup[];

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

export enum CampaignStatus {
    DRAFT = 0,
    ACTIVE = 1,
    INACTIVE = 2,
    TERMINATED = 3,
}

export interface Campaign {
    id: string;
    channel: string;
    status: CampaignStatus;
    starts?: number[];
    end?: number | null;
    updated_at: string;
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
    triggering_conditions: TriggeringConditions;
    triggering_event_filters?: TriggeringEventFilter[];
    delay?: number;
}
