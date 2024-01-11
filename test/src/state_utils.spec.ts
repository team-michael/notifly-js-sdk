import { mergeEventCounts } from '../../src/Core/User/Utils';

describe('Test for state utils', () => {
    test('should correctly merge event counts - 1', () => {
        const merged = mergeEventCounts(
            [
                {
                    count: 1,
                    dt: '2021-07-01',
                    event_params: {},
                    name: 'test',
                },
            ],
            [
                {
                    count: 1,
                    dt: '2021-07-01',
                    event_params: {},
                    name: 'test',
                },
            ]
        );
        const answer = [
            {
                count: 2,
                dt: '2021-07-01',
                event_params: {},
                name: 'test',
            },
        ];
        expect(merged).toEqual(answer);
    });

    test('should correctly merge event counts - 2', () => {
        const merged = mergeEventCounts(
            [
                {
                    count: 1,
                    dt: '2021-07-01',
                    event_params: {},
                    name: 'test',
                },
            ],
            [
                {
                    count: 1,
                    dt: '2021-07-02',
                    event_params: {},
                    name: 'test',
                },
            ]
        );
        const answer = [
            {
                count: 1,
                dt: '2021-07-01',
                event_params: {},
                name: 'test',
            },
            {
                count: 1,
                dt: '2021-07-02',
                event_params: {},
                name: 'test',
            },
        ];
        expect(merged).toEqual(answer);
    });

    test('should correctly merge event counts - 3', () => {
        const merged = mergeEventCounts(
            [
                {
                    count: 1,
                    dt: '2021-07-01',
                    event_params: {},
                    name: 'test',
                },
                {
                    count: 1,
                    dt: '2021-07-01',
                    event_params: { 'key1': 'value1' },
                    name: 'test',
                },
            ],
            [
                {
                    count: 1,
                    dt: '2021-07-01',
                    event_params: {},
                    name: 'test',
                },
                {
                    count: 1,
                    dt: '2021-07-01',
                    event_params: { 'key1': 'value1' },
                    name: 'test',
                },
                {
                    count: 1,
                    dt: '2021-07-02',
                    event_params: {},
                    name: 'test',
                },
            ]
        );
        const answer = [
            {
                count: 2,
                dt: '2021-07-01',
                event_params: {},
                name: 'test',
            },
            {
                count: 2,
                dt: '2021-07-01',
                event_params: { 'key1': 'value1' },
                name: 'test',
            },
            {
                count: 1,
                dt: '2021-07-02',
                event_params: {},
                name: 'test',
            },
        ];
        expect(merged).toEqual(answer);
    });
});
