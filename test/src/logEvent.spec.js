const { v5 } = require('uuid');
const { getNotiflyUserID } = require('../../src/logEvent');
const { NAMESPACE } = require('../../src/constants');

describe('getNotiflyUserID', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: jest.fn(),
            },
            writable: true,
        });
    });

    afterEach(() => {
        window.localStorage.getItem.mockRestore();
    });

    test('should return registered user ID when external user ID is available in localStorage', () => {
        const deviceToken = 'deviceToken';
        const externalUserID = 'externalUserID';
        const expectedUserID = v5(externalUserID, NAMESPACE.REGISTERED_USERID).replace(/-/g, '');

        window.localStorage.getItem.mockReturnValue(externalUserID);

        const result = getNotiflyUserID(deviceToken);

        expect(window.localStorage.getItem).toHaveBeenCalledWith('__notiflyExternalUserID');
        expect(result).toBe(expectedUserID);
    });

    test('should return unregistered user ID when external user ID is not available in localStorage', () => {
        const deviceToken = 'deviceToken';
        const expectedUserID = v5(deviceToken, NAMESPACE.UNREGISTERED_USERID).replace(/-/g, '');

        window.localStorage.getItem.mockReturnValue(null);

        const result = getNotiflyUserID(deviceToken);

        expect(window.localStorage.getItem).toHaveBeenCalledWith('__notiflyExternalUserID');
        expect(result).toBe(expectedUserID);
    });
});
