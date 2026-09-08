import { KmpUserIdTransitionPolicy } from '../../src/Core/KmpCore';

describe('KMP Core connectivity', () => {
    test('can call the shared policy', () => {
        expect(KmpUserIdTransitionPolicy.evaluate(null, 'connectivity-check')).toBeDefined();
    });
});
