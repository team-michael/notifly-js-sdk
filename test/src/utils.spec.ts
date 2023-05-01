import { v5 } from 'uuid';
import { NAMESPACE } from '../../src/constants';
import { getNotiflyUserID, getPlatform } from '../../src/utils';

describe('getNotiflyUserID', () => {
    const originalLocalStorage = window.localStorage;

    beforeEach(() => {
        const mockLocalStorage = {
            getItem: jest.fn(),
        };
        Object.defineProperty(window, 'localStorage', {
            value: mockLocalStorage,
            writable: true,
        });
    });

    afterEach(() => {
        window.localStorage.getItem = originalLocalStorage.getItem;
    });

    test('should return notifly user ID when notifly user ID is available in localStorage', () => {
        const deviceToken = 'deviceToken';
        const externalUserID = 'externalUserID';
        const notiflyUserID = 'notiflyUserID';
        const expectedUserID = notiflyUserID;

        (window.localStorage.getItem as jest.Mock).mockReturnValue(notiflyUserID);

        const result = getNotiflyUserID(externalUserID, deviceToken);

        expect(window.localStorage.getItem).toHaveBeenCalledWith('__notiflyUserID');
        expect(result).toBe(expectedUserID);
    });

    test('should return registered user ID when external user ID is available in localStorage', () => {
        const deviceToken = 'deviceToken';
        const externalUserID = 'externalUserID';
        const expectedUserID = v5(externalUserID, NAMESPACE.REGISTERED_USERID).replace(/-/g, '');
        const mockLocalStorageGetItem = jest.spyOn(window.localStorage, 'getItem');
        mockLocalStorageGetItem.mockImplementation((key: string) => {
            if (key === '__notiflyExternalUserID') {
                return externalUserID;
            } else if (key === '__notiflyDeviceToken') {
                return deviceToken;
            } else {
                return null;
            }
        });

        const result = getNotiflyUserID(undefined, deviceToken);

        expect(window.localStorage.getItem).toHaveBeenCalledWith('__notiflyUserID');
        expect(window.localStorage.getItem).toHaveBeenCalledWith('__notiflyExternalUserID');
        expect(result).toBe(expectedUserID);
    });

    test('should return unregistered user ID when external user ID is not available in localStorage', () => {
        const deviceToken = 'deviceToken';
        const expectedUserID = v5(deviceToken, NAMESPACE.UNREGISTERED_USERID).replace(/-/g, '');

        const mockLocalStorageGetItem = jest.spyOn(window.localStorage, 'getItem');
        mockLocalStorageGetItem.mockImplementation((key: string) => {
            if (key === '__notiflyDeviceToken') {
                return deviceToken;
            } else {
                return null;
            }
        });

        const result = getNotiflyUserID(undefined, undefined);

        expect(window.localStorage.getItem).toHaveBeenCalledWith('__notiflyUserID');
        expect(window.localStorage.getItem).toHaveBeenCalledWith('__notiflyExternalUserID');
        expect(window.localStorage.getItem).toHaveBeenCalledWith('__notiflyDeviceToken');
        expect(result).toBe(expectedUserID);
    });
});

describe('getPlatform', () => {
    it('returns the correct platform for iOS user agent', () => {
        const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1';
        Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
        expect(getPlatform()).toEqual('ios');
    });

    it('returns the correct platform for Android user agent', () => {
        const userAgent = 'Mozilla/5.0 (Linux; Android 11; SM-A115F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.105 Mobile Safari/537.36';
        Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
        expect(getPlatform()).toEqual('android');
    });

    it('returns the correct platform for web user agent', () => {
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36';
        Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
        expect(getPlatform()).toEqual('web');
    });

    it('returns unknown platform for unknown user agent', () => {
        const userAgent = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
        Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
        expect(getPlatform()).toEqual('unknown');
    });
});
