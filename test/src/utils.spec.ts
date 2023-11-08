import uuid from 'uuid';
import storage from '../../src/Core/Storage/LocalForage';
import { NAMESPACE } from '../../src/Constants';
import { getPlatform, storeUserIdentity } from '../../src/Core/Utils';

jest.mock('localforage', () => ({
    createInstance: jest.fn(() => {
        return {
            config: jest.fn(),
            getItem: jest.fn().mockImplementation(() => Promise.resolve(null)),
            setItem: jest.fn().mockImplementation(() => Promise.resolve(null)),
            ready: jest.fn().mockImplementation(() => Promise.resolve(true)),
        };
    }),
}));

jest.mock('uuid', () => ({
    v4: jest.fn().mockImplementation(() => Promise.resolve(null)),
    v5: jest.fn().mockImplementation(() => Promise.resolve(null)),
}));

describe('store user identity', () => {
    beforeEach(() => {
        jest.clearAllMocks(); // Clears the mock.calls and mock.instances properties of all mocks.
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restores all mocks back to their original value.
    });

    test('Correctly store user identity', async () => {
        const projectID = 'test';
        const externalUserID = 'externalUserID';

        const expectedNotiflyUserId = `${projectID}${externalUserID}-${NAMESPACE.REGISTERED_USERID}`.replace(/-/g, '');
        const expectedDeviceId = 'uuid-v4-mocked-string';

        const mockStorage = <any>{
            __notiflyProjectID: projectID,
            __notiflyExternalUserID: externalUserID,
        };

        jest.spyOn(storage, 'getItem').mockImplementation((key: string) => {
            switch (key) {
                case '__notiflyProjectID':
                    return mockStorage.__notiflyProjectID;
                case '__notiflyUserID':
                    return mockStorage.__notiflyUserID;
                case '__notiflyExternalUserID':
                    return mockStorage.__notiflyExternalUserID;
                default:
                    return Promise.resolve(null);
            }
        });
        jest.spyOn(storage, 'setItem').mockImplementation((key: string, value: unknown) => {
            mockStorage[key] = value;
            return Promise.resolve();
        });

        jest.spyOn(uuid, 'v4').mockImplementation(() => 'uuid-v4-mocked-string');
        jest.spyOn(uuid, 'v5').mockImplementation(
            (name: string | ArrayLike<number>, namespace: string | ArrayLike<number>) => {
                if (typeof name === 'string' && typeof namespace === 'string') {
                    return `${name}-${namespace}`;
                }
                return '';
            }
        );

        await storeUserIdentity();

        expect(mockStorage.__notiflyUserID).toEqual(expectedNotiflyUserId);
        expect(mockStorage.__notiflyDeviceID).toEqual(expectedDeviceId);
    });
});

describe('getPlatform', () => {
    it('returns the correct platform for iOS user agent', () => {
        const userAgent =
            'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1';
        Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
        expect(getPlatform()).toEqual('ios');
    });

    it('returns the correct platform for Android user agent', () => {
        const userAgent =
            'Mozilla/5.0 (Linux; Android 11; SM-A115F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.105 Mobile Safari/537.36';
        Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
        expect(getPlatform()).toEqual('android');
    });

    it('returns the correct platform for web user agent', () => {
        const userAgent =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36';
        Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
        expect(getPlatform()).toEqual('web');
    });

    it('returns web platform for unknown user agent', () => {
        const userAgent = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
        Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
        expect(getPlatform()).toEqual('web');
    });
});
