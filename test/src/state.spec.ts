import type { Campaign } from '../../src/Types';

import { WebMessageManager } from '../../src/WebMessages/Manager';

jest.mock('localforage', () => ({
    config: jest.fn(),
}));

jest.useFakeTimers().setSystemTime(new Date('2023-05-31'));

describe('updateEventIntermediateCounts', () => {
    beforeEach(() => {
        WebMessageManager.eventIntermediateCounts = [];
    });

    test('should update the count of an existing row', () => {
        WebMessageManager.eventIntermediateCounts = [
            { dt: '2023-05-26', name: 'Event A', count: 3, event_params: {} },
            { dt: '2023-05-26', name: 'Event B', count: 5, event_params: {} },
        ];

        WebMessageManager.updateEventCounts('Event A', {});

        const eventIntermediateCounts = WebMessageManager.eventIntermediateCounts;
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].count === 4);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].dt === '2023-05-26');
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].count === 5);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].dt === '2023-05-26');
    });

    test('should add a new entry when no existing row is found', () => {
        WebMessageManager.eventIntermediateCounts = [
            { dt: '2023-05-26', name: 'Event A', count: 4, event_params: {} },
            { dt: '2023-05-26', name: 'Event B', count: 5, event_params: {} },
        ];

        WebMessageManager.updateEventCounts('Event C', {});

        const eventIntermediateCounts = WebMessageManager.eventIntermediateCounts;
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].count === 4);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].dt === '2023-05-26');
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].count === 5);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].dt === '2023-05-26');
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event C')[0].count === 1);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event C')[0].dt === '2023-05-26');
    });

    test('should create a new entry when the array is empty', () => {
        WebMessageManager.updateEventCounts('Event A', {});

        const eventIntermediateCounts = WebMessageManager.eventIntermediateCounts;
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].count === 1);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].dt === '2023-05-26');
    });

    test('should increase the count of an existing row', () => {
        WebMessageManager.eventIntermediateCounts = [{ dt: '2023-05-26', name: 'Event A', count: 2, event_params: {} }];

        WebMessageManager.updateEventCounts('Event A', {});

        const eventIntermediateCounts = WebMessageManager.eventIntermediateCounts;
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].count === 3);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].dt === '2023-05-26');
    });

    test('should not modify the array when the event name does not match an existing row', () => {
        WebMessageManager.eventIntermediateCounts = [{ dt: '2023-05-26', name: 'Event A', count: 2, event_params: {} }];

        WebMessageManager.updateEventCounts('Event B', {});

        const eventIntermediateCounts = WebMessageManager.eventIntermediateCounts;
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].count === 2);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].dt === '2023-05-26');
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].count === 1);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].dt === '2023-05-26');
    });
});

// describe('getCampaignsToSchedule', () => {
//     beforeAll(() => {
//         jest.spyOn(WebMessageManager, '_matchCondition').mockImplementation(() => {
//             return true;
//         });
//     });
//     afterAll(() => {
//         (WebMessageManager._matchCondition as any).mockRestore();
//     });

//     const campaigns: Campaign[] = [
//         {
//             id: 'test-campaign-1',
//             triggering_event: 'event1',
//             channel: 'in-web-message',
//             delay: 0,
//             last_updated_timestamp: 1625800000000,
//             message: { html_url: '', modal_properties: { template_name: '' } },
//             segment_type: 'condition',
//         },
//         {
//             id: 'test-campaign-2',
//             triggering_event: 'event2',
//             channel: 'in-web-message',
//             delay: 10,
//             last_updated_timestamp: 1625700000000,
//             message: { html_url: '', modal_properties: { template_name: '' } },
//             segment_type: 'condition',
//         },
//         {
//             id: 'test-campaign-3',
//             triggering_event: 'event1',
//             channel: 'in-web-message',
//             delay: 20,
//             last_updated_timestamp: 1625900000000,
//             message: { html_url: '', modal_properties: { template_name: '' } },
//             segment_type: 'condition',
//         },
//         {
//             id: 'test-campaign-4',
//             triggering_event: 'event2',
//             channel: 'in-web-message',
//             delay: 5,
//             last_updated_timestamp: 1625600000000,
//             message: { html_url: '', modal_properties: { template_name: '' } },
//             segment_type: 'condition',
//         },
//         {
//             id: 'test-campaign-5',
//             triggering_event: 'event1',
//             channel: 'in-web-message',
//             delay: 20,
//             last_updated_timestamp: 1625700000000,
//             message: { html_url: '', modal_properties: { template_name: '' } },
//             segment_type: 'condition',
//         },
//     ];

//     it('Test case 1: Valid event name with matching campaigns', () => {
//         const result = WebMessageManager.getCampaignsToSchedule(campaigns, 'event1', {}, null);
//         expect(result.map((campaign) => campaign.id)).toEqual(['test-campaign-1', 'test-campaign-3']);
//     });

//     it('Test case 2: Valid event name with no matching campaigns', () => {
//         const nonExistingEventName = 'event3';
//         const result = WebMessageManager.getCampaignsToSchedule(campaigns, nonExistingEventName, {}, null);
//         expect(result).toEqual([]);
//     });
// });

describe('checkCondition', () => {
    beforeEach(() => {
        WebMessageManager.eventIntermediateCounts = [];
    });

    test('should return false for non-condition segment type', () => {
        const campaign: Campaign = {
            id: 'test-id',
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            last_updated_timestamp: 0,
            triggering_event: 'test-event',
            segment_type: 'some_other_type',
        };

        const result = WebMessageManager.isEntityOfSegment(campaign, 'test-event', {}, null);

        expect(result).toBe(false);
    });

    test('should return true when no groups are present', () => {
        const campaign: Campaign = {
            id: 'test-id',
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

        const result = WebMessageManager.isEntityOfSegment(campaign, 'test-event', {}, null);

        expect(result).toBe(true);
    });

    test('should return false when no conditions are present', () => {
        const campaign: Campaign = {
            id: 'test-id',
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

        const result = WebMessageManager.isEntityOfSegment(campaign, 'test-event', {}, null);

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
        WebMessageManager.eventIntermediateCounts = eventIntermediateCounts;

        const campaign: Campaign = {
            id: 'test-id',
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

        const result = WebMessageManager.isEntityOfSegment(campaign, 'test-event', {}, null);

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
        WebMessageManager.eventIntermediateCounts = eventIntermediateCounts;

        const campaign: Campaign = {
            id: 'test-id',
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

        const result = WebMessageManager.isEntityOfSegment(campaign, 'test-event', {}, null);

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
        WebMessageManager.eventIntermediateCounts = eventIntermediateCounts;

        const campaign: Campaign = {
            id: 'test-id',
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

        const result = WebMessageManager.isEntityOfSegment(campaign, 'test-event', {}, null);

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
        WebMessageManager.eventIntermediateCounts = eventIntermediateCounts;

        const campaign: Campaign = {
            id: 'test-id',
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

        const result = WebMessageManager.isEntityOfSegment(campaign, 'test-event', {}, null);

        expect(result).toBe(true);
    });

    test('should return true for user property condition with matching value', () => {
        WebMessageManager.userData = {
            user_properties: {
                age: 30,
                gender: 'male',
            },
        };

        const campaign: Campaign = {
            id: 'test-id',
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

        const result = WebMessageManager.isEntityOfSegment(campaign, 'test-event', {}, null);

        expect(result).toBe(true);
    });

    test('should return false for user property condition with non-matching value', () => {
        WebMessageManager.userData = {
            user_properties: {
                age: 30,
                gender: 'male',
            },
        };

        const campaign: Campaign = {
            id: 'test-id',
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

        const result = WebMessageManager.isEntityOfSegment(campaign, 'test-event', {}, null);

        expect(result).toBe(false);
    });
    test('should return true for when one of two conditions are met (two conditions are in two separate groups)', () => {
        // Meets age condition but not country condition
        WebMessageManager.userData = {
            user_properties: {
                age: 30,
                gender: 'male',
                country: 'USA',
            },
        };

        const campaign: Campaign = {
            id: 'test-id',
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

        const result = WebMessageManager.isEntityOfSegment(campaign, 'test-event', {}, null);

        expect(result).toBe(true);
    });
    test('should return false for conditions in groups are all not satisfied', () => {
        WebMessageManager.userData = {
            user_properties: {
                age: 30,
                gender: 'male',
                country: 'USA',
            },
        };

        const campaign: Campaign = {
            id: 'test-id',
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

        const result = WebMessageManager.isEntityOfSegment(campaign, 'test-event', {}, null);

        expect(result).toBe(false);
    });
    test('should return true for when group with multiple conditions is satisfied while other groups are not satisfied', () => {
        WebMessageManager.userData = {
            user_properties: {
                age: 30,
                gender: 'male',
                country: 'USA',
            },
        };

        const campaign: Campaign = {
            id: 'test-id',
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

        const result = WebMessageManager.isEntityOfSegment(campaign, 'test-event', {}, null);

        expect(result).toBe(true);
    });
    test('should return true for when group with single conditions is satisfied while other groups are not satisfied', () => {
        WebMessageManager.userData = {
            user_properties: {
                age: 30,
                gender: 'male',
                country: 'USA',
            },
        };

        const campaign: Campaign = {
            id: 'test-id',
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

        const result = WebMessageManager.isEntityOfSegment(campaign, 'test-event', {}, null);

        expect(result).toBe(true);
    });
    test('test group mix with user condition and event condition', () => {
        WebMessageManager.userData = {
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
        WebMessageManager.eventIntermediateCounts = eventIntermediateCounts;

        const campaign: Campaign = {
            id: 'test-id',
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

        const result = WebMessageManager.isEntityOfSegment(campaign, 'test-event', {}, null);

        expect(result).toBe(true);
    });
    test('test another group mix with user condition and event condition', () => {
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() - 5);
        const formattedDate = currentDate.toISOString().split('T')[0];

        WebMessageManager.userData = {
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
        WebMessageManager.eventIntermediateCounts = eventIntermediateCounts;

        const campaign: Campaign = {
            id: 'test-id',
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

        const result = WebMessageManager.isEntityOfSegment(campaign, 'test-event', {}, null);

        expect(result).toBe(true);
    });
});
