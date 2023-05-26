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
        expect(eventIntermediateCounts).toEqual([
            { dt: '2023-05-26', name: 'Event A', count: 4 },
            { dt: '2023-05-26', name: 'Event B', count: 5 },
        ]);
    });

    test('should add a new entry when no existing row is found', () => {
        setEventIntermediateCountsForTest([
            { dt: '2023-05-26', name: 'Event A', count: 4 },
            { dt: '2023-05-26', name: 'Event B', count: 5 },
        ]);

        updateEventIntermediateCounts('Event C');

        const eventIntermediateCounts = getEventIntermediateCountsForTest();
        expect(eventIntermediateCounts).toEqual([
            { dt: '2023-05-26', name: 'Event A', count: 4 },
            { dt: '2023-05-26', name: 'Event B', count: 5 },
            { dt: expect.any(String), name: 'Event C', count: 1 },
        ]);
    });

    test('should create a new entry when the array is empty', () => {
        updateEventIntermediateCounts('Event A');

        const eventIntermediateCounts = getEventIntermediateCountsForTest();
        expect(eventIntermediateCounts).toEqual([{ dt: expect.any(String), name: 'Event A', count: 1 }]);
    });

    test('should increase the count of an existing row', () => {
        setEventIntermediateCountsForTest([{ dt: '2023-05-26', name: 'Event A', count: 2 }]);

        updateEventIntermediateCounts('Event A');

        const eventIntermediateCounts = getEventIntermediateCountsForTest();
        expect(eventIntermediateCounts).toEqual([{ dt: '2023-05-26', name: 'Event A', count: 3 }]);
    });

    test('should not modify the array when the event name does not match an existing row', () => {
        setEventIntermediateCountsForTest([{ dt: '2023-05-26', name: 'Event A', count: 2 }]);

        updateEventIntermediateCounts('Event B');

        const eventIntermediateCounts = getEventIntermediateCountsForTest();
        expect(eventIntermediateCounts).toEqual([
            { dt: '2023-05-26', name: 'Event A', count: 2 },
            { dt: '2023-05-26', name: 'Event B', count: 1 },
        ]);
    });
});

describe('checkCondition', () => {
    beforeEach(() => {
        setEventIntermediateCountsForTest([]);
    });

    test('should return false for non-condition segment type', () => {
        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '' },
            triggering_event: 'test-event',
            segment_type: 'some_other_type',
        };

        const result = checkConditionForTest(campaign);

        expect(result).toBe(false);
    });

    test('should return true when no groups are present', () => {
        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '' },
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
            message: { html_url: '' },
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
        const eventIntermediateCounts = [
            { dt: '2023-05-26', name: 'Event A', count: 3 },
            { dt: '2023-05-26', name: 'Event B', count: 5 },
        ];
        setEventIntermediateCountsForTest(eventIntermediateCounts);

        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '' },
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
        const eventIntermediateCounts = [
            { dt: '2023-05-26', name: 'Event A', count: 3 },
            { dt: '2023-05-26', name: 'Event B', count: 5 },
        ];
        setEventIntermediateCountsForTest(eventIntermediateCounts);

        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '' },
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

    test('should return true for user property condition with matching value', () => {
        setUserDataForTest({
            user_properties: {
                age: 30,
                gender: 'male',
            },
        });

        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '' },
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
        const userData = {
            user_properties: {
                age: 30,
                gender: 'male',
            },
        };

        const campaign = {
            channel: 'in-web-message',
            message: { html_url: '' },
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
});
