import { NotiflyStorage } from '../../src/Core/Storage';
import { SdkState, SdkStateManager } from '../../src/Core/SdkState';
import { EventLogger } from '../../src/Core/Event';
import { UserIdentityManager } from '../../src/Core/User';

jest.mock('../../src/Core/Event');
jest.mock('../../src/Core/Storage', () => ({
    ...jest.requireActual('../../src/Core/Storage'),
    NotiflyStorage: {
        ensureInitialized: jest.fn(),
        getItems: jest.fn(),
        getItem: jest.fn(),
        getNotiflyUserId: jest.fn().mockResolvedValue('previous_notifly_user_id'),
        setItems: jest.fn(),
        setItem: jest.fn(),
        removeItems: jest.fn(),
        removeItem: jest.fn(),
    },
}));
jest.mock('../../src/Core/API', () => ({
    NotiflyAPI: {
        initialize: jest.fn().mockReturnValue(Promise.resolve()),
        call: jest.fn().mockImplementation(() =>
            Promise.resolve({
                campaignData: [],
                eventIntermediateCountsData: [],
                userData: {},
            })
        ),
    },
}));

describe('setUserProperties', () => {
    beforeEach(() => {
        jest.clearAllMocks(); // Clears the mock.calls and mock.instances properties of all mocks.
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restores all mocks back to their original value.
    });

    test('sets external_user_id in storage and logs the event', async () => {
        const _mockStorage = <Record<string, string>>{
            __notiflyProjectID: 'test',
            __notiflyDeviceID: 'test',
        };
        jest.spyOn(NotiflyStorage, 'getItem').mockImplementation((key: string) => {
            return Promise.resolve(_mockStorage[key] || null);
        });
        jest.spyOn(NotiflyStorage, 'getItems').mockImplementation((keys: string[]) => {
            return Promise.resolve(keys.map((key) => _mockStorage[key] || null));
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

        expect(NotiflyStorage.setItem).toHaveBeenCalledWith('__notiflyExternalUserID', '1234567890');
        expect(EventLogger.logEvent).toHaveBeenCalledWith('set_user_properties', expectedParams, null, true);
    });

    test('does not set external_user_id in storage and logs the event when params do not include external_user_id', async () => {
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
