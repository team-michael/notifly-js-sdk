import { _urlBase64ToUint8Array, _getSubscription } from '../../src/Client/Push';

global.PushSubscription = jest.fn();
jest.mock('localforage', () => ({
    config: jest.fn(),
}));

describe('push', () => {
    test('_urlBase64ToUint8Array: should convert base64 to Uint8Array', () => {
        const base64 = 'BfUyRqHqXl';
        const result = _urlBase64ToUint8Array(base64);
        expect(result).toBeInstanceOf(Uint8Array);
        expect(result).toEqual(Uint8Array.from([5, 245, 50, 70, 161, 234, 94]));
    });

    test('_getSubscription: returns an existing subscription if one exists', async () => {
        const mockSubscription = new PushSubscription();
        const mockRegistration: Partial<ServiceWorkerRegistration> = {
            pushManager: {
                getSubscription: jest.fn().mockResolvedValue(mockSubscription),
                subscribe: jest.fn().mockResolvedValue({}),
                permissionState: jest.fn().mockResolvedValue('granted'),
            },
        };
        const result = await _getSubscription(mockRegistration as ServiceWorkerRegistration, 'BfUyRqHqXl');
        expect(result).toBe(mockSubscription);
    });

    test('_getSubscription: returns a new subscription if one does not exist', async () => {
        const mockRegistration: Partial<ServiceWorkerRegistration> = {
            pushManager: {
                getSubscription: jest.fn().mockResolvedValue(null),
                subscribe: jest.fn().mockResolvedValue({}),
                permissionState: jest.fn().mockResolvedValue('granted'),
            },
        };
        const result = await _getSubscription(mockRegistration as ServiceWorkerRegistration, 'BfUyRqHqXl');
        const mockSubscription = new PushSubscription();
        expect(result).toEqual(mockSubscription);
    });
});
