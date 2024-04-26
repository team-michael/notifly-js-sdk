import type { Campaign } from '../../src/Core/Interfaces/Campaign';

import { UserStateManager } from '../../src/Core/User/State';
import { WebMessageManager } from '../../src/Core/WebMessages/Manager';

jest.mock('localforage', () => ({
    createInstance: jest.fn(() => {
        return {
            config: jest.fn(),
            getItem: jest.fn().mockImplementation(() => Promise.resolve(null)),
            setItem: jest.fn().mockImplementation(() => Promise.resolve(null)),
            ready: jest.fn().mockImplementation(() => Promise.resolve(true)),
        };
    }),
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
    const campaigns: Campaign[] = [
        {
            id: 'test-campaign-1',
            status: 1,
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'event1',
                    },
                ],
            ],
            channel: 'in-web-message',
            delay: 0,
            updated_at: '2021-07-09T03:06:40.000Z',
            starts: [1625800000],
            end: null,
            message: { html_url: '', modal_properties: { template_name: '' } },
            segment_type: 'condition',
        },
        {
            id: 'test-campaign-2',
            status: 1,
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'event2',
                    },
                ],
            ],
            channel: 'in-web-message',
            delay: 10,
            updated_at: '2021-07-07T23:20:00.000Z',
            starts: [1685501200],
            end: null,
            message: { html_url: '', modal_properties: { template_name: '' } },
            segment_type: 'condition',
        },
        {
            id: 'test-campaign-3',
            status: 2,
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'event1',
                    },
                ],
            ],
            channel: 'in-web-message',
            delay: 20,
            updated_at: '2021-07-10T06:53:20.000Z',
            starts: [1685511200],
            end: null,
            message: { html_url: '', modal_properties: { template_name: '' } },
            segment_type: 'condition',
        },
        {
            id: 'test-campaign-4',
            status: 1,
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'event2',
                    },
                ],
            ],
            channel: 'in-web-message',
            delay: 5,
            updated_at: '2021-07-06T19:33:20.000Z',
            starts: [1685291200],
            end: 1685391200,
            message: { html_url: '', modal_properties: { template_name: '' } },
            segment_type: 'condition',
        },
        {
            id: 'test-campaign-5',
            status: 1,
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'event1',
                    },
                ],
            ],
            channel: 'in-web-message',
            delay: 20,
            updated_at: '2021-07-07T23:20:00.000Z',
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
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'test-event',
                    },
                ],
            ],
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
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'test-event',
                    },
                ],
            ],
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

    test('should correctly apply specified triggering conditions', () => {
        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: 'starts_with',
                        operand: 'fresh',
                    },
                    {
                        type: 'event_name',
                        operator: 'ends_with',
                        operand: 'juice',
                    },
                ],
                [
                    {
                        type: 'event_name',
                        operator: 'matches_regex',
                        operand: '^(orange|apple|banana).*$',
                    },
                ],
                [
                    {
                        type: 'event_name',
                        operator: 'contains',
                        operand: 'fruit',
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

        const result1 = WebMessageManager.isEventApplicableForCampaign(campaign, 'fresh_juice', {});
        const result2 = WebMessageManager.isEventApplicableForCampaign(campaign, 'apple_juice', {});
        const result3 = WebMessageManager.isEventApplicableForCampaign(campaign, 'banana_juice', {});
        const result4 = WebMessageManager.isEventApplicableForCampaign(campaign, 'orange_juice', {});
        const result5 = WebMessageManager.isEventApplicableForCampaign(campaign, 'fresh_fruit', {});
        const result6 = WebMessageManager.isEventApplicableForCampaign(campaign, 'strange_food', {});
        const result7 = WebMessageManager.isEventApplicableForCampaign(campaign, 'mustard', {});

        expect(result1).toBe(true);
        expect(result2).toBe(true);
        expect(result3).toBe(true);
        expect(result4).toBe(true);
        expect(result5).toBe(true);
        expect(result6).toBe(false);
        expect(result7).toBe(false);
    });

    test('should correctly apply specified triggering conditions - 2', () => {
        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '!=',
                        operand: 'purchase',
                    },
                    {
                        type: 'event_name',
                        operator: 'does_not_match_regex',
                        operand: '^(buy|sell)$',
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

        const result1 = WebMessageManager.isEventApplicableForCampaign(campaign, 'purchase', {});
        const result2 = WebMessageManager.isEventApplicableForCampaign(campaign, 'buy', {});
        const result3 = WebMessageManager.isEventApplicableForCampaign(campaign, 'sell', {});
        const result4 = WebMessageManager.isEventApplicableForCampaign(campaign, 'rent', {});

        expect(result1).toBe(false);
        expect(result2).toBe(false);
        expect(result3).toBe(false);
        expect(result4).toBe(true);
    });

    test('should return false when invalid regex is given', () => {
        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: 'matches_regex',
                        // Invalid regex
                        operand: '^(orange|apple|banana.*$',
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

        const result1 = WebMessageManager.isEventApplicableForCampaign(campaign, 'any', {});
        const result2 = WebMessageManager.isEventApplicableForCampaign(campaign, 'of', {});
        const result3 = WebMessageManager.isEventApplicableForCampaign(campaign, 'these', {});
        const result4 = WebMessageManager.isEventApplicableForCampaign(campaign, 'should', {});
        const result5 = WebMessageManager.isEventApplicableForCampaign(campaign, 'return', {});
        const result6 = WebMessageManager.isEventApplicableForCampaign(campaign, 'false', {});

        expect(result1).toBe(false);
        expect(result2).toBe(false);
        expect(result3).toBe(false);
        expect(result4).toBe(false);
        expect(result5).toBe(false);
        expect(result6).toBe(false);
    });

    test('should return false for non-condition segment type', () => {
        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            updated_at: '2023-04-30T00:00:00.000Z',
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'test-event',
                    },
                ],
            ],
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
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'test-event',
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

        const result = WebMessageManager.isEntityOfSegment(campaign, {}, null);

        expect(result).toBe(true);
    });

    test('should return false when no conditions are present', () => {
        const campaign: Campaign = {
            id: 'test-id',
            status: 1,
            channel: 'in-web-message',
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'test-event',
                    },
                ],
            ],
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
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'test-event',
                    },
                ],
            ],
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
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'test-event',
                    },
                ],
            ],
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
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'test-event',
                    },
                ],
            ],
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
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'test-event',
                    },
                ],
            ],
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
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'test-event',
                    },
                ],
            ],
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
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'test-event',
                    },
                ],
            ],
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
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'test-event',
                    },
                ],
            ],
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
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'test-event',
                    },
                ],
            ],
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
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'test-event',
                    },
                ],
            ],
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
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'test-event',
                    },
                ],
            ],
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
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'test-event',
                    },
                ],
            ],
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
            updated_at: '2023-04-30T00:00:00.000Z',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_conditions: [
                [
                    {
                        type: 'event_name',
                        operator: '=',
                        operand: 'test-event',
                    },
                ],
            ],
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
