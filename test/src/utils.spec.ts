/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPlatform } from '../../src/Core/Utils';

jest.mock('../../src/Core/Storage', () => ({
    ...jest.requireActual('../../src/Core/Storage'),
    NotiflyStorage: {
        ensureInitialized: jest.fn(),
        getNotiflyUserId: jest.fn().mockResolvedValue('test'),
        getItems: jest.fn(),
        getItem: jest.fn(),
        setItems: jest.fn(),
        setItem: jest.fn(),
        removeItems: jest.fn(),
        removeItem: jest.fn(),
    },
}));

jest.mock('uuid', () => ({
    v4: jest.fn().mockImplementation(() => Promise.resolve(null)),
    v5: jest.fn().mockImplementation(() => Promise.resolve(null)),
}));

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
