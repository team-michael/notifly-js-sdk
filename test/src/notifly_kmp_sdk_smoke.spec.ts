import { KmpUserIdTransitionPolicy } from '../../src/Core/KmpCore';

describe('Notifly KMP SDK smoke host', () => {
    test('can call the shared policy', () => {
        expect(KmpUserIdTransitionPolicy.evaluate(null, 'connectivity-check')).toBeDefined();
    });
});
