import localForage from 'localforage';
import { setUserProperties } from '../../src/user';
import { logEvent } from '../../src/logEvent';

jest.mock('../../src/logEvent');
jest.mock('localforage', () => ({
    getItem: jest.fn().mockImplementation(() => Promise.resolve(null)),
    setItem: jest.fn().mockImplementation(() => Promise.resolve(null)),
}));

describe('setUserProperties', () => {
    beforeEach(() => {
        jest.clearAllMocks();  // Clears the mock.calls and mock.instances properties of all mocks.
    });

    afterEach(() => {
        jest.restoreAllMocks();  // Restores all mocks back to their original value.
    });

    test('sets external_user_id in localForage and logs the event', async () => {
        const params = {
            external_user_id: '1234567890',
        };
        const expectedParams = {
            external_user_id: '1234567890',
            previous_external_user_id: null,
            previous_notifly_user_id: null,
        };

        await setUserProperties(params);

        expect(localForage.getItem).toHaveBeenCalledWith('__notiflyExternalUserID');
        expect(localForage.getItem).toHaveBeenCalledWith('__notiflyUserID');
        expect(localForage.setItem).toHaveBeenCalledWith('__notiflyExternalUserID', '1234567890');
        expect(logEvent).toHaveBeenCalledWith('set_user_properties', expectedParams, null, true);
    });

    test('does not set external_user_id in localForage and logs the event when params do not include external_user_id', async () => {
        const params = {
            user_name: 'john',
            email: 'john@example.com',
        };
        const expectedParams = {
            user_name: 'john',
            email: 'john@example.com',
        };

        await setUserProperties(params);

        expect(logEvent).toHaveBeenCalledWith('set_user_properties', expectedParams, null, true);
    });
});
