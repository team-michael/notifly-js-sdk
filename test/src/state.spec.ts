import type { Campaign } from '../../src/Core/Interfaces/Campaign';

import { UserStateManager } from '../../src/Core/User/State';
import { WebMessageManager } from '../../src/Core/WebMessages/Manager';

jest.mock('../../src/Core/Storage', () => ({
    ...jest.requireActual('../../src/Core/Storage'),
    NotiflyStorage: {
        ensureInitialized: jest.fn(),
        getItems: jest.fn(),
        getItem: jest.fn(),
        setItems: jest.fn(),
        setItem: jest.fn(),
        removeItems: jest.fn(),
        removeItem: jest.fn(),
    },
}));

jest.useFakeTimers().setSystemTime(new Date('2023-05-31'));

describe('updateEventIntermediateCounts', () => {
    beforeEach(() => {
        UserStateManager.eventIntermediateCounts = [];
    });

    test('should update the count of an existing row', () => {
        UserStateManager.eventIntermediateCounts = [
            { dt: '2023-05-26', name: 'Event A', count: 3, event_params: {} },
            { dt: '2023-05-26', name: 'Event B', count: 5, event_params: {} },
        ];

        UserStateManager.updateEventCounts('Event A', {});

        const eventIntermediateCounts = UserStateManager.eventIntermediateCounts;
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].count === 4);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].dt === '2023-05-26');
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].count === 5);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].dt === '2023-05-26');
    });

    test('should add a new entry when no existing row is found', () => {
        UserStateManager.eventIntermediateCounts = [
            { dt: '2023-05-26', name: 'Event A', count: 4, event_params: {} },
            { dt: '2023-05-26', name: 'Event B', count: 5, event_params: {} },
        ];

        UserStateManager.updateEventCounts('Event C', {});

        const eventIntermediateCounts = UserStateManager.eventIntermediateCounts;
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].count === 4);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].dt === '2023-05-26');
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].count === 5);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].dt === '2023-05-26');
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event C')[0].count === 1);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event C')[0].dt === '2023-05-26');
    });

    test('should create a new entry when the array is empty', () => {
        UserStateManager.updateEventCounts('Event A', {});

        const eventIntermediateCounts = UserStateManager.eventIntermediateCounts;
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].count === 1);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].dt === '2023-05-26');
    });

    test('should increase the count of an existing row', () => {
        UserStateManager.eventIntermediateCounts = [{ dt: '2023-05-26', name: 'Event A', count: 2, event_params: {} }];

        UserStateManager.updateEventCounts('Event A', {});

        const eventIntermediateCounts = UserStateManager.eventIntermediateCounts;
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].count === 3);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].dt === '2023-05-26');
    });

    test('should not modify the array when the event name does not match an existing row', () => {
        UserStateManager.eventIntermediateCounts = [{ dt: '2023-05-26', name: 'Event A', count: 2, event_params: {} }];

        UserStateManager.updateEventCounts('Event B', {});

        const eventIntermediateCounts = UserStateManager.eventIntermediateCounts;
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].count === 2);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].dt === '2023-05-26');
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].count === 1);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].dt === '2023-05-26');
    });
});

describe('getCampaignsToSchedule', () => {
    // now: 1685491200000
    console.log(Date.now());
    const campaigns: Campaign[] = [
        {
            id: 'test-campaign-1',
            status: 1,
            triggering_event: 'event1',
            channel: 'in-web-message',
            delay: 0,
            last_updated_timestamp: 1625800000000,
            starts: [1625800000],
            end: null,
            message: { html_url: '', modal_properties: { template_name: '' } },
            segment_type: 'condition',
        },
        {
            id: 'test-campaign-2',
            status: 1,
            triggering_event: 'event2',
            channel: 'in-web-message',
            delay: 10,
            last_updated_timestamp: 1625700000000,
            starts: [1685501200],
            end: null,
            message: { html_url: '', modal_properties: { template_name: '' } },
            segment_type: 'condition',
        },
        {
            id: 'test-campaign-3',
            status: 2,
            triggering_event: 'event1',
            channel: 'in-web-message',
            delay: 20,
            last_updated_timestamp: 1625900000000,
            starts: [1685511200],
            end: null,
            message: { html_url: '', modal_properties: { template_name: '' } },
            segment_type: 'condition',
        },
        {
            id: 'test-campaign-4',
            status: 1,
            triggering_event: 'event2',
            channel: 'in-web-message',
            delay: 5,
            last_updated_timestamp: 1625600000000,
            starts: [1685291200],
            end: 1685391200,
            message: { html_url: '', modal_properties: { template_name: '' } },
            segment_type: 'condition',
        },
        {
            id: 'test-campaign-5',
            status: 1,
            triggering_event: 'event1',
            channel: 'in-web-message',
            delay: 20,
            last_updated_timestamp: 1625700000000,
            starts: [1685891100],
            end: null,
            message: { html_url: '', modal_properties: { template_name: '' } },
            segment_type: 'condition',
        },
    ];

    it('Test case 1: Valid event name with matching campaigns', () => {
        const result = WebMessageManager.getCampaignsToSchedule(campaigns, 'event1', {}, null);
        expect(result.map((campaign) => campaign.id).sort()).toEqual(['test-campaign-1']);
    });

    it('Test case 2: Valid event name with no matching campaigns', () => {
        const nonExistingEventName = 'event3';
        const result = WebMessageManager.getCampaignsToSchedule(campaigns, nonExistingEventName, {}, null);
        expect(result).toEqual([]);
    });
});

describe('checkCondition', () => {
    beforeEach(() => {
        UserStateManager.eventIntermediateCounts = [];
    });

    test('should correctly filter event based on provided triggering event filters - 1', () => {
        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            last_updated_timestamp: 0,
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            triggering_event_filters: [
                [
                    {
                        key: 'test-key-1',
                        operator: '=',
                        value: 'test-value-1',
                        value_type: 'TEXT',
                    },
                    {
                        key: 'test-key-2',
                        operator: '=',
                        value: 'test-value-2',
                        value_type: 'TEXT',
                    },
                ],
            ],
            segment_type: 'condition',
            segment_info: {
                groups: [],
                group_operator: null,
            },
            delay: 0,
        };

        const result = WebMessageManager.isEventApplicableForCampaign(campaign, 'test-event', {
            'test-key-1': 'test-value-1',
            'test-key-2': 'test-value-2',
        });

        expect(result).toBe(true);
    });

    test('should correctly filter event based on provided triggering event filters - 2', () => {
        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            last_updated_timestamp: 0,
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            triggering_event_filters: [
                [
                    {
                        key: 'test-key-1',
                        operator: 'IS_NULL',
                    },
                    {
                        key: 'test-key-2',
                        operator: 'IS_NOT_NULL',
                    },
                ],
                [
                    {
                        key: 'test-key-3',
                        operator: '@>',
                        value: 'test-value-3',
                        value_type: 'TEXT',
                    },
                ],
            ],
            segment_type: 'condition',
            segment_info: {
                groups: [],
                group_operator: null,
            },
            delay: 0,
        };

        const result1 = WebMessageManager.isEventApplicableForCampaign(campaign, 'test-event', {
            'test-key-2': 'test-value-2',
        });
        const result2 = WebMessageManager.isEventApplicableForCampaign(campaign, 'test-event', {
            'test-key-1': 'test-value-1',
        });
        const result3 = WebMessageManager.isEventApplicableForCampaign(campaign, 'test-event', {
            'test-key-3': ['test-value-3'],
        });
        const result4 = WebMessageManager.isEventApplicableForCampaign(campaign, 'test-event', {
            'test-key-3': ['test-value'],
        });

        expect(result1).toBe(true);
        expect(result2).toBe(false);
        expect(result3).toBe(true);
        expect(result4).toBe(false);
    });

    test('should return false for non-condition segment type', () => {
        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            last_updated_timestamp: 0,
            triggering_event: 'test-event',
            segment_type: 'some_other_type',
        };

        const result = WebMessageManager.isEntityOfSegment(campaign, {}, null);

        expect(result).toBe(false);
    });

    test('should return true when no groups are present', () => {
        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            last_updated_timestamp: 0,
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [],
                group_operator: null,
            },
            delay: 0,
        };

        const result = WebMessageManager.isEntityOfSegment(campaign, {}, null);

        expect(result).toBe(true);
    });

    test('should return false when no conditions are present', () => {
        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            last_updated_timestamp: 0,
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [],
                        condition_operator: null,
                    },
                ],
                group_operator: null,
            },
            delay: 0,
        };

        const result = WebMessageManager.isEntityOfSegment(campaign, {}, null);

        expect(result).toBe(false);
    });

    test('should return true for event count condition with matching count', () => {
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() - 3);
        const formattedDate = currentDate.toISOString().split('T')[0];

        const eventIntermediateCounts = [
            { dt: formattedDate, name: 'Event A', count: 3, event_params: {} },
            { dt: formattedDate, name: 'Event B', count: 5, event_params: {} },
        ];
        UserStateManager.eventIntermediateCounts = eventIntermediateCounts;

        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            last_updated_timestamp: 0,
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                event: 'Event A',
                                event_condition_type: 'count X',
                                operator: '>=',
                                secondary_value: 0,
                                unit: 'event',
                                value: 3,
                            },
                        ],
                        condition_operator: null,
                    },
                ],
                group_operator: null,
            },
            delay: 0,
        };

        const result = WebMessageManager.isEntityOfSegment(campaign, {}, null);

        expect(result).toBe(true);
    });

    test('should return false for event count condition with non-matching count', () => {
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() - 1);
        const formattedDate = currentDate.toISOString().split('T')[0];

        const eventIntermediateCounts = [
            { dt: formattedDate, name: 'Event A', count: 3, event_params: {} },
            { dt: formattedDate, name: 'Event B', count: 5, event_params: {} },
        ];
        UserStateManager.eventIntermediateCounts = eventIntermediateCounts;

        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            last_updated_timestamp: 0,
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                event: 'Event A',
                                event_condition_type: 'count X',
                                operator: '>=',
                                secondary_value: 0,
                                unit: 'event',
                                value: 5,
                            },
                        ],
                        condition_operator: null,
                    },
                ],
                group_operator: null,
            },
            delay: 0,
        };

        const result = WebMessageManager.isEntityOfSegment(campaign, {}, null);

        expect(result).toBe(false);
    });

    test('should return false for event count condition with low count', () => {
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() - 1);
        const formattedDate = currentDate.toISOString().split('T')[0];

        const eventIntermediateCounts = [
            { dt: formattedDate, name: 'Event A', count: 1, event_params: {} },
            { dt: formattedDate, name: 'Event B', count: 5, event_params: {} },
        ];
        UserStateManager.eventIntermediateCounts = eventIntermediateCounts;

        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            last_updated_timestamp: 0,
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                event: 'Event A',
                                event_condition_type: 'count X in Y days',
                                operator: '>=',
                                secondary_value: 5,
                                unit: 'event',
                                value: 2,
                            },
                        ],
                        condition_operator: null,
                    },
                ],
                group_operator: null,
            },
            delay: 0,
        };

        const result = WebMessageManager.isEntityOfSegment(campaign, {}, null);

        expect(result).toBe(false);
    });

    test('should return true for event count condition with high count', () => {
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() - 3);
        const formattedDate = currentDate.toISOString().split('T')[0];

        const eventIntermediateCounts = [
            { dt: formattedDate, name: 'Event A', count: 10, event_params: {} },
            { dt: formattedDate, name: 'Event B', count: 5, event_params: {} },
        ];
        UserStateManager.eventIntermediateCounts = eventIntermediateCounts;

        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            last_updated_timestamp: 0,
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                event: 'Event A',
                                event_condition_type: 'count X in Y days',
                                operator: '>=',
                                secondary_value: 5,
                                unit: 'event',
                                value: 2,
                            },
                        ],
                        condition_operator: null,
                    },
                ],
                group_operator: null,
            },
            delay: 0,
        };

        const result = WebMessageManager.isEntityOfSegment(campaign, {}, null);

        expect(result).toBe(true);
    });

    test('should return true for user property condition with matching value', () => {
        UserStateManager.userData = {
            user_properties: {
                age: 30,
                gender: 'male',
            },
        };

        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            last_updated_timestamp: 0,
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: 'age',
                                operator: '>=',
                                unit: 'user',
                                value: 25,
                                valueType: 'INT',
                            },
                        ],
                        condition_operator: null,
                    },
                ],
                group_operator: null,
            },
        };

        const result = WebMessageManager.isEntityOfSegment(campaign, {}, null);

        expect(result).toBe(true);
    });

    test('should return false for user property condition with non-matching value', () => {
        UserStateManager.userData = {
            user_properties: {
                age: 30,
                gender: 'male',
            },
        };

        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            last_updated_timestamp: 0,
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: 'age',
                                operator: '<',
                                unit: 'user',
                                value: 25,
                                valueType: 'INT',
                            },
                        ],
                        condition_operator: null,
                    },
                ],
                group_operator: null,
            },
        };

        const result = WebMessageManager.isEntityOfSegment(campaign, {}, null);

        expect(result).toBe(false);
    });
    test('should return true for when one of two conditions are met (two conditions are in two separate groups)', () => {
        // Meets age condition but not country condition
        UserStateManager.userData = {
            user_properties: {
                age: 30,
                gender: 'male',
                country: 'USA',
            },
        };

        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            last_updated_timestamp: 0,
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: 'age',
                                operator: '>=',
                                unit: 'user',
                                value: 25,
                                valueType: 'INT',
                            },
                        ],
                        condition_operator: null,
                    },
                    {
                        conditions: [
                            {
                                attribute: 'country',
                                operator: '<>',
                                unit: 'user',
                                value: 'USA',
                                valueType: 'TEXT',
                            },
                        ],
                        condition_operator: null,
                    },
                ],
                group_operator: 'OR',
            },
        };

        const result = WebMessageManager.isEntityOfSegment(campaign, {}, null);

        expect(result).toBe(true);
    });
    test('should return false for conditions in groups are all not satisfied', () => {
        UserStateManager.userData = {
            user_properties: {
                age: 30,
                gender: 'male',
                country: 'USA',
            },
        };

        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            last_updated_timestamp: 0,
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: 'age',
                                operator: '<',
                                unit: 'user',
                                value: 25,
                                valueType: 'INT',
                            },
                        ],
                        condition_operator: null,
                    },
                    {
                        conditions: [
                            {
                                attribute: 'country',
                                operator: '<>',
                                unit: 'user',
                                value: 'USA',
                                valueType: 'TEXT',
                            },
                        ],
                        condition_operator: null,
                    },
                    {
                        conditions: [
                            {
                                attribute: 'gender',
                                operator: '=',
                                unit: 'user',
                                value: 'female',
                                valueType: 'TEXT',
                            },
                        ],
                        condition_operator: null,
                    },
                ],
                group_operator: 'OR',
            },
        };

        const result = WebMessageManager.isEntityOfSegment(campaign, {}, null);

        expect(result).toBe(false);
    });
    test('should return true for when group with multiple conditions is satisfied while other groups are not satisfied', () => {
        UserStateManager.userData = {
            user_properties: {
                age: 30,
                gender: 'male',
                country: 'USA',
            },
        };

        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            last_updated_timestamp: 0,
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: 'age',
                                operator: '>',
                                unit: 'user',
                                value: 25,
                                valueType: 'INT',
                            },
                            {
                                attribute: 'gender',
                                operator: '=',
                                unit: 'user',
                                value: 'male',
                                valueType: 'TEXT',
                            },
                            {
                                attribute: 'country',
                                operator: '<>',
                                unit: 'user',
                                value: 'UK',
                                valueType: 'TEXT',
                            },
                        ],
                        condition_operator: 'AND',
                    },
                    {
                        conditions: [
                            {
                                attribute: 'country',
                                operator: '<>',
                                unit: 'user',
                                value: 'USA',
                                valueType: 'TEXT',
                            },
                        ],
                        condition_operator: null,
                    },
                    {
                        conditions: [
                            {
                                attribute: 'gender',
                                operator: '=',
                                unit: 'user',
                                value: 'female',
                                valueType: 'TEXT',
                            },
                        ],
                        condition_operator: null,
                    },
                ],
                group_operator: 'OR',
            },
        };

        const result = WebMessageManager.isEntityOfSegment(campaign, {}, null);

        expect(result).toBe(true);
    });
    test('should return true for when group with single conditions is satisfied while other groups are not satisfied', () => {
        UserStateManager.userData = {
            user_properties: {
                age: 30,
                gender: 'male',
                country: 'USA',
            },
        };

        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            last_updated_timestamp: 0,
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: 'age',
                                operator: '=',
                                unit: 'user',
                                value: 25,
                                valueType: 'INT',
                            },
                            {
                                attribute: 'gender',
                                operator: '<>',
                                unit: 'user',
                                value: 'male',
                                valueType: 'TEXT',
                            },
                            {
                                attribute: 'country',
                                operator: '=',
                                unit: 'user',
                                value: 'UK',
                                valueType: 'TEXT',
                            },
                        ],
                        condition_operator: 'AND',
                    },
                    {
                        conditions: [
                            {
                                attribute: 'country',
                                operator: '<>',
                                unit: 'user',
                                value: 'USA',
                                valueType: 'TEXT',
                            },
                        ],
                        condition_operator: null,
                    },
                    {
                        conditions: [
                            {
                                attribute: 'gender',
                                operator: '=',
                                unit: 'user',
                                value: 'male',
                                valueType: 'TEXT',
                            },
                        ],
                        condition_operator: null,
                    },
                ],
                group_operator: 'OR',
            },
        };

        const result = WebMessageManager.isEntityOfSegment(campaign, {}, null);

        expect(result).toBe(true);
    });
    test('test group mix with user condition and event condition', () => {
        UserStateManager.userData = {
            user_properties: {
                age: 30,
                gender: 'male',
                country: 'USA',
            },
        };
        const eventIntermediateCounts = [
            { dt: '2023-05-26', name: 'Event A', count: 3, event_params: {} },
            { dt: '2023-05-26', name: 'Event B', count: 5, event_params: {} },
        ];
        UserStateManager.eventIntermediateCounts = eventIntermediateCounts;

        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            last_updated_timestamp: 0,
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: 'age',
                                operator: '>',
                                unit: 'user',
                                value: 25,
                                valueType: 'INT',
                            },
                            {
                                event: 'Event A',
                                event_condition_type: 'count X',
                                operator: '>=',
                                secondary_value: 0,
                                unit: 'event',
                                value: 3,
                            },
                            {
                                attribute: 'country',
                                operator: '=',
                                unit: 'user',
                                value: 'USA',
                                valueType: 'TEXT',
                            },
                        ],
                        condition_operator: 'AND',
                    },
                    {
                        conditions: [
                            {
                                attribute: 'country',
                                operator: '<>',
                                unit: 'user',
                                value: 'USA',
                                valueType: 'TEXT',
                            },
                        ],
                        condition_operator: null,
                    },
                    {
                        conditions: [
                            {
                                attribute: 'gender',
                                operator: '=',
                                unit: 'user',
                                value: 'female',
                                valueType: 'TEXT',
                            },
                        ],
                        condition_operator: null,
                    },
                ],
                group_operator: 'OR',
            },
        };

        const result = WebMessageManager.isEntityOfSegment(campaign, {}, null);

        expect(result).toBe(true);
    });
    test('test another group mix with user condition and event condition', () => {
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() - 5);
        const formattedDate = currentDate.toISOString().split('T')[0];

        UserStateManager.userData = {
            user_properties: {
                age: 30,
                gender: 'male',
                country: 'USA',
            },
        };
        const eventIntermediateCounts = [
            { dt: formattedDate, name: 'Event A', count: 3, event_params: {} },
            { dt: formattedDate, name: 'Event B', count: 5, event_params: {} },
        ];
        UserStateManager.eventIntermediateCounts = eventIntermediateCounts;

        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            last_updated_timestamp: 0,
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: 'age',
                                operator: '>',
                                unit: 'user',
                                value: 25,
                                valueType: 'INT',
                            },
                            {
                                event: 'Event A',
                                event_condition_type: 'count X in Y days',
                                operator: '=',
                                secondary_value: 7,
                                unit: 'event',
                                value: 3,
                            },
                            {
                                attribute: 'country',
                                operator: '=',
                                unit: 'user',
                                value: 'USA',
                                valueType: 'TEXT',
                            },
                        ],
                        condition_operator: 'AND',
                    },
                    {
                        conditions: [
                            {
                                attribute: 'country',
                                operator: '<>',
                                unit: 'user',
                                value: 'USA',
                                valueType: 'TEXT',
                            },
                        ],
                        condition_operator: null,
                    },
                    {
                        conditions: [
                            {
                                attribute: 'gender',
                                operator: '=',
                                unit: 'user',
                                value: 'female',
                                valueType: 'TEXT',
                            },
                        ],
                        condition_operator: null,
                    },
                ],
                group_operator: 'OR',
            },
        };

        const result = WebMessageManager.isEntityOfSegment(campaign, {}, null);

        expect(result).toBe(true);
    });
});
