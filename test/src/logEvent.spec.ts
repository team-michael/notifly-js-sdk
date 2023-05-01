import { v5 } from 'uuid';
import { getNotiflyUserID } from '../../src/logEvent';
import { NAMESPACE } from '../../src/constants';

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

    test('should return registered user ID when external user ID is available in localStorage', () => {
        const deviceToken = 'deviceToken';
        const externalUserID = 'externalUserID';
        const expectedUserID = v5(externalUserID, NAMESPACE.REGISTERED_USERID).replace(/-/g, '');

        (window.localStorage.getItem as jest.Mock).mockReturnValue(externalUserID);

        const result = getNotiflyUserID(deviceToken);

        expect(window.localStorage.getItem).toHaveBeenCalledWith('__notiflyExternalUserID');
        expect(result).toBe(expectedUserID);
    });

    test('should return unregistered user ID when external user ID is not available in localStorage', () => {
        const deviceToken = 'deviceToken';
        const expectedUserID = v5(deviceToken, NAMESPACE.UNREGISTERED_USERID).replace(/-/g, '');

        (window.localStorage.getItem as jest.Mock).mockReturnValue(null);

        const result = getNotiflyUserID(deviceToken);

        expect(window.localStorage.getItem).toHaveBeenCalledWith('__notiflyExternalUserID');
        expect(result).toBe(expectedUserID);
    });
});
