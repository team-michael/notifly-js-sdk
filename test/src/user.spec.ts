import { setUserProperties } from '../../src/user';
import { logEvent } from '../../src/logEvent';

jest.mock('../../src/logEvent');

describe('setUserProperties', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('sets external_user_id in localStorage and logs the event', async () => {
        const params = {
            external_user_id: '1234567890',
        };
        const expectedParams = {
            external_user_id: '1234567890',
        };

        await setUserProperties(params);

        expect(localStorage.getItem('__notiflyExternalUserID')).toBe('1234567890');
        expect(localStorage.getItem('__notiflyUserId')).toBeNull();
        expect(logEvent).toHaveBeenCalledWith('set_user_properties', expectedParams, null, true);
    });

    test('does not set external_user_id in localStorage and logs the event when params do not include external_user_id', async () => {
        const params = {
            user_name: 'john',
            email: 'john@example.com',
        };
        const expectedParams = {
            user_name: 'john',
            email: 'john@example.com',
        };

        await setUserProperties(params);

        expect(localStorage.getItem('__notiflyExternalUserID')).toBeNull();
        expect(localStorage.getItem('__notiflyUserId')).toBeNull();
        expect(logEvent).toHaveBeenCalledWith('set_user_properties', expectedParams, null, true);
    });
});
