import {
    updateEventIntermediateCounts,
    getEventIntermediateCountsForTest,
    setEventIntermediateCountsForTest,
    checkConditionForTest,
    setUserDataForTest,
} from '../../src/state';

describe('updateEventIntermediateCounts', () => {
    beforeEach(() => {
        setEventIntermediateCountsForTest([]);
    });

    test('should update the count of an existing row', () => {
        setEventIntermediateCountsForTest([
            { dt: '2023-05-26', name: 'Event A', count: 3 },
            { dt: '2023-05-26', name: 'Event B', count: 5 },
        ]);

        updateEventIntermediateCounts('Event A');

        const eventIntermediateCounts = getEventIntermediateCountsForTest();
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].count === 4);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].dt === '2023-05-26');
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].count === 5);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].dt === '2023-05-26');
    });

    test('should add a new entry when no existing row is found', () => {
        setEventIntermediateCountsForTest([
            { dt: '2023-05-26', name: 'Event A', count: 4 },
            { dt: '2023-05-26', name: 'Event B', count: 5 },
        ]);

        updateEventIntermediateCounts('Event C');

        const eventIntermediateCounts = getEventIntermediateCountsForTest();
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].count === 4);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].dt === '2023-05-26');
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].count === 5);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].dt === '2023-05-26');
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event C')[0].count === 1);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event C')[0].dt === '2023-05-26');
    });

    test('should create a new entry when the array is empty', () => {
        updateEventIntermediateCounts('Event A');

        const eventIntermediateCounts = getEventIntermediateCountsForTest();
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].count === 1);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].dt === '2023-05-26');
    });

    test('should increase the count of an existing row', () => {
        setEventIntermediateCountsForTest([{ dt: '2023-05-26', name: 'Event A', count: 2 }]);

        updateEventIntermediateCounts('Event A');

        const eventIntermediateCounts = getEventIntermediateCountsForTest();
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].count === 3);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].dt === '2023-05-26');
    });

    test('should not modify the array when the event name does not match an existing row', () => {
        setEventIntermediateCountsForTest([{ dt: '2023-05-26', name: 'Event A', count: 2 }]);

        updateEventIntermediateCounts('Event B');

        const eventIntermediateCounts = getEventIntermediateCountsForTest();
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].count === 2);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event A')[0].dt === '2023-05-26');
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].count === 1);
        expect(eventIntermediateCounts.filter((x) => x.name == 'Event B')[0].dt === '2023-05-26');
    });
});

describe('checkCondition', () => {
    beforeEach(() => {
        setEventIntermediateCountsForTest([]);
    });

    test('should return false for non-condition segment type', () => {
        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'some_other_type',
        };

        const result = checkConditionForTest(campaign);

        expect(result).toBe(false);
    });

    test('should return true when no groups are present', () => {
        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [],
            },
        };

        const result = checkConditionForTest(campaign);

        expect(result).toBe(true);
    });

    test('should return false when no conditions are present', () => {
        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [],
                    },
                ],
            },
        };

        const result = checkConditionForTest(campaign);

        expect(result).toBe(false);
    });

    test('should return true for event count condition with matching count', () => {
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() - 3);
        const formattedDate = currentDate.toISOString().split('T')[0];

        const eventIntermediateCounts = [
            { dt: formattedDate, name: 'Event A', count: 3 },
            { dt: formattedDate, name: 'Event B', count: 5 },
        ];
        setEventIntermediateCountsForTest(eventIntermediateCounts);

        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: '',
                                event: 'Event A',
                                event_condition_type: 'count X',
                                operator: '>=',
                                secondary_value: 0,
                                unit: 'event',
                                value: 3,
                            },
                        ],
                    },
                ],
            },
        };

        const result = checkConditionForTest(campaign);

        expect(result).toBe(true);
    });

    test('should return false for event count condition with non-matching count', () => {
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() - 1);
        const formattedDate = currentDate.toISOString().split('T')[0];

        const eventIntermediateCounts = [
            { dt: formattedDate, name: 'Event A', count: 3 },
            { dt: formattedDate, name: 'Event B', count: 5 },
        ];
        setEventIntermediateCountsForTest(eventIntermediateCounts);

        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: '',
                                event: 'Event A',
                                event_condition_type: 'count X',
                                operator: '>=',
                                secondary_value: 0,
                                unit: 'event',
                                value: 5,
                            },
                        ],
                    },
                ],
            },
        };

        const result = checkConditionForTest(campaign);

        expect(result).toBe(false);
    });

    test('should return false for event count condition with low count', () => {
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() - 1);
        const formattedDate = currentDate.toISOString().split('T')[0];

        const eventIntermediateCounts = [
            { dt: formattedDate, name: 'Event A', count: 1 },
            { dt: formattedDate, name: 'Event B', count: 5 },
        ];
        setEventIntermediateCountsForTest(eventIntermediateCounts);

        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: '',
                                event: 'Event A',
                                event_condition_type: 'count X in Y days',
                                operator: '>=',
                                secondary_value: 5,
                                unit: 'event',
                                value: 2,
                            },
                        ],
                    },
                ],
            },
        };

        const result = checkConditionForTest(campaign);

        expect(result).toBe(false);
    });

    test('should return true for event count condition with high count', () => {
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() - 3);
        const formattedDate = currentDate.toISOString().split('T')[0];

        const eventIntermediateCounts = [
            { dt: formattedDate, name: 'Event A', count: 10 },
            { dt: formattedDate, name: 'Event B', count: 5 },
        ];
        setEventIntermediateCountsForTest(eventIntermediateCounts);

        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: '',
                                event: 'Event A',
                                event_condition_type: 'count X in Y days',
                                operator: '>=',
                                secondary_value: 5,
                                unit: 'event',
                                value: 2,
                            },
                        ],
                    },
                ],
            },
        };

        const result = checkConditionForTest(campaign);

        expect(result).toBe(true);
    });

    test('should return true for user property condition with matching value', () => {
        setUserDataForTest({
            user_properties: {
                age: 30,
                gender: 'male',
            },
        });

        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: 'age',
                                event: '',
                                event_condition_type: '',
                                operator: '>=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 25,
                            },
                        ],
                    },
                ],
            },
        };

        const result = checkConditionForTest(campaign);

        expect(result).toBe(true);
    });

    test('should return false for user property condition with non-matching value', () => {
        setUserDataForTest({
            user_properties: {
                age: 30,
                gender: 'male',
            },
        });

        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: 'age',
                                event: '',
                                event_condition_type: '',
                                operator: '<',
                                secondary_value: 0,
                                unit: 'user',
                                value: 25,
                            },
                        ],
                    },
                ],
            },
        };

        const result = checkConditionForTest(campaign);

        expect(result).toBe(false);
    });
    test('should return true for when one of two conditions are met (two conditions are in two separate groups)', () => {
        // Meets age condition but not country condition
        setUserDataForTest({
            user_properties: {
                age: 30,
                gender: 'male',
                country: 'USA',
            },
        });

        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: 'age',
                                event: '',
                                event_condition_type: '',
                                operator: '>=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 25,
                            },
                        ],
                    },
                    {
                        conditions: [
                            {
                                attribute: 'country',
                                event: '',
                                event_condition_type: '',
                                operator: '<>',
                                secondary_value: 0,
                                unit: 'user',
                                value: 'USA',
                            },
                        ],
                    },
                ],
                group_operator: 'OR',
            },
        };

        const result = checkConditionForTest(campaign);

        expect(result).toBe(true);
    });
    test('should return false for conditions in groups are all not satisfied', () => {
        setUserDataForTest({
            user_properties: {
                age: 30,
                gender: 'male',
                country: 'USA',
            },
        });

        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: 'age',
                                event: '',
                                event_condition_type: '',
                                operator: '<',
                                secondary_value: 0,
                                unit: 'user',
                                value: 25,
                            },
                        ],
                    },
                    {
                        conditions: [
                            {
                                attribute: 'country',
                                event: '',
                                event_condition_type: '',
                                operator: '!=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 'USA',
                            },
                        ],
                    },
                    {
                        conditions: [
                            {
                                attribute: 'gender',
                                event: '',
                                event_condition_type: '',
                                operator: '=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 'female',
                            },
                        ],
                    },
                ],
                group_operator: 'OR',
            },
        };

        const result = checkConditionForTest(campaign);

        expect(result).toBe(false);
    });
    test('should return true for when group with multiple conditions is satisfied while other groups are not satisfied', () => {
        setUserDataForTest({
            user_properties: {
                age: 30,
                gender: 'male',
                country: 'USA',
            },
        });

        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: 'age',
                                event: '',
                                event_condition_type: '',
                                operator: '>',
                                secondary_value: 0,
                                unit: 'user',
                                value: 25,
                            },
                            {
                                attribute: 'gender',
                                event: '',
                                event_condition_type: '',
                                operator: '=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 'male',
                            },
                            {
                                attribute: 'country',
                                event: '',
                                event_condition_type: '',
                                operator: '!=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 'UK',
                            },
                        ],
                        condition_operator: 'AND',
                    },
                    {
                        conditions: [
                            {
                                attribute: 'country',
                                event: '',
                                event_condition_type: '',
                                operator: '!=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 'USA',
                            },
                        ],
                    },
                    {
                        conditions: [
                            {
                                attribute: 'gender',
                                event: '',
                                event_condition_type: '',
                                operator: '=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 'female',
                            },
                        ],
                    },
                ],
                group_operator: 'OR',
            },
        };

        const result = checkConditionForTest(campaign);

        expect(result).toBe(true);
    });
    test('should return true for when group with single conditions is satisfied while other groups are not satisfied', () => {
        setUserDataForTest({
            user_properties: {
                age: 30,
                gender: 'male',
                country: 'USA',
            },
        });

        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: 'age',
                                event: '',
                                event_condition_type: '',
                                operator: '=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 25,
                            },
                            {
                                attribute: 'gender',
                                event: '',
                                event_condition_type: '',
                                operator: '!=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 'male',
                            },
                            {
                                attribute: 'country',
                                event: '',
                                event_condition_type: '',
                                operator: '=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 'UK',
                            },
                        ],
                        condition_operator: 'AND',
                    },
                    {
                        conditions: [
                            {
                                attribute: 'country',
                                event: '',
                                event_condition_type: '',
                                operator: '!=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 'USA',
                            },
                        ],
                    },
                    {
                        conditions: [
                            {
                                attribute: 'gender',
                                event: '',
                                event_condition_type: '',
                                operator: '=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 'male',
                            },
                        ],
                    },
                ],
                group_operator: 'OR',
            },
        };

        const result = checkConditionForTest(campaign);

        expect(result).toBe(true);
    });
    test('test group mix with user condition and event condition', () => {
        setUserDataForTest({
            user_properties: {
                age: 30,
                gender: 'male',
                country: 'USA',
            },
        });
        const eventIntermediateCounts = [
            { dt: '2023-05-26', name: 'Event A', count: 3 },
            { dt: '2023-05-26', name: 'Event B', count: 5 },
        ];
        setEventIntermediateCountsForTest(eventIntermediateCounts);

        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: 'age',
                                event: '',
                                event_condition_type: '',
                                operator: '>',
                                secondary_value: 0,
                                unit: 'user',
                                value: 25,
                            },
                            {
                                attribute: '',
                                event: 'Event A',
                                event_condition_type: 'count X',
                                operator: '>=',
                                secondary_value: 0,
                                unit: 'event',
                                value: 3,
                            },
                            {
                                attribute: 'country',
                                event: '',
                                event_condition_type: '',
                                operator: '=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 'USA',
                            },
                        ],
                        condition_operator: 'AND',
                    },
                    {
                        conditions: [
                            {
                                attribute: 'country',
                                event: '',
                                event_condition_type: '',
                                operator: '!=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 'USA',
                            },
                        ],
                    },
                    {
                        conditions: [
                            {
                                attribute: 'gender',
                                event: '',
                                event_condition_type: '',
                                operator: '=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 'female',
                            },
                        ],
                    },
                ],
                group_operator: 'OR',
            },
        };

        const result = checkConditionForTest(campaign);

        expect(result).toBe(true);
    });
    test('test another group mix with user condition and event condition', () => {
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() - 5);
        const formattedDate = currentDate.toISOString().split('T')[0];

        setUserDataForTest({
            user_properties: {
                age: 30,
                gender: 'male',
                country: 'USA',
            },
        });
        const eventIntermediateCounts = [
            { dt: formattedDate, name: 'Event A', count: 3 },
            { dt: formattedDate, name: 'Event B', count: 5 },
        ];
        setEventIntermediateCountsForTest(eventIntermediateCounts);

        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '', modal_properties: { template_name: 'test-template' } },
            triggering_event: 'test-event',
            segment_type: 'condition',
            segment_info: {
                groups: [
                    {
                        conditions: [
                            {
                                attribute: 'age',
                                event: '',
                                event_condition_type: '',
                                operator: '>',
                                secondary_value: 0,
                                unit: 'user',
                                value: 25,
                            },
                            {
                                attribute: '',
                                event: 'Event A',
                                event_condition_type: 'count X in Y days',
                                operator: '=',
                                secondary_value: 7,
                                unit: 'event',
                                value: 3,
                            },
                            {
                                attribute: 'country',
                                event: '',
                                event_condition_type: '',
                                operator: '=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 'USA',
                            },
                        ],
                        condition_operator: 'AND',
                    },
                    {
                        conditions: [
                            {
                                attribute: 'country',
                                event: '',
                                event_condition_type: '',
                                operator: '!=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 'USA',
                            },
                        ],
                    },
                    {
                        conditions: [
                            {
                                attribute: 'gender',
                                event: '',
                                event_condition_type: '',
                                operator: '=',
                                secondary_value: 0,
                                unit: 'user',
                                value: 'female',
                            },
                        ],
                    },
                ],
                group_operator: 'OR',
            },
        };

        const result = checkConditionForTest(campaign);

        expect(result).toBe(true);
    });
});
