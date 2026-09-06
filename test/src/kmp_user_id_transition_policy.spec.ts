import { evaluateUserIdTransition } from '../../src/Core/KMP/UserIdTransitionPolicy';

describe('KMP user ID transition policy adapter', () => {
    test.each([
        {
            previousUserId: null,
            newUserId: null,
            expected: { changed: false, shouldSync: false, shouldMerge: false, shouldClear: true },
        },
        {
            previousUserId: null,
            newUserId: 'user-a',
            expected: { changed: true, shouldSync: true, shouldMerge: true, shouldClear: false },
        },
        {
            previousUserId: 'user-a',
            newUserId: 'user-a',
            expected: { changed: false, shouldSync: false, shouldMerge: false, shouldClear: false },
        },
        {
            previousUserId: 'user-a',
            newUserId: 'user-b',
            expected: { changed: true, shouldSync: true, shouldMerge: false, shouldClear: false },
        },
        {
            previousUserId: 'user-a',
            newUserId: null,
            expected: { changed: true, shouldSync: true, shouldMerge: false, shouldClear: true },
        },
    ])('$previousUserId -> $newUserId', ({ previousUserId, newUserId, expected }) => {
        expect(evaluateUserIdTransition(previousUserId, newUserId)).toEqual(expected);
    });
});
