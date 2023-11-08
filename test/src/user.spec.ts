import storage from '../../src/Core/Storage/LocalForage';
import { SdkState, SdkStateManager } from '../../src/Core/SdkState';
import { EventLogger } from '../../src/Core/Event';
import { UserIdentityManager } from '../../src/Core/User';

jest.mock('../../src/Core/Event');
jest.mock('../../src/Core/Storage/LocalForage', () => ({
    config: jest.fn(),
    getItem: jest.fn().mockImplementation(() => Promise.resolve(null)),
    setItem: jest.fn().mockImplementation(() => Promise.resolve(null)),
    ready: jest.fn().mockImplementation(() => Promise.resolve(true)),
}));

describe('setUserProperties', () => {
    beforeEach(() => {
        jest.clearAllMocks(); // Clears the mock.calls and mock.instances properties of all mocks.
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restores all mocks back to their original value.
    });

    test('sets external_user_id in localForage and logs the event', async () => {
        jest.spyOn(storage, 'getItem').mockImplementation((key: string) => {
            if (key === '__notiflyProjectID') {
                return Promise.resolve('test');
            } else if (key === '__notiflyUserID') {
                return Promise.resolve('previous_notifly_user_id');
            } else {
                return Promise.resolve(null);
            }
        });

        const params = {
            external_user_id: '1234567890',
        };
        const expectedParams = {
            external_user_id: '1234567890',
            previous_external_user_id: null,
            previous_notifly_user_id: 'previous_notifly_user_id',
        };

        // Assume sdk is initialized
        SdkStateManager.state = SdkState.READY;
        await UserIdentityManager.setUserProperties(params);

        expect(storage.getItem).toHaveBeenCalledWith('__notiflyProjectID');
        expect(storage.getItem).toHaveBeenCalledWith('__notiflyUserID');
        expect(storage.getItem).toHaveBeenCalledWith('__notiflyExternalUserID');
        expect(storage.setItem).toHaveBeenCalledWith('__notiflyExternalUserID', '1234567890');
        expect(EventLogger.logEvent).toHaveBeenCalledWith('set_user_properties', expectedParams, null, true);
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

        await UserIdentityManager.setUserProperties(params);

        expect(EventLogger.logEvent).toHaveBeenCalledWith('set_user_properties', expectedParams, null, true);
    });
});
