// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'v5'.
const { v5 } = require('uuid');
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getNotifly... Remove this comment to see the full error message
const { getNotiflyUserID } = require('../../src/logEvent');
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NAMESPACE'... Remove this comment to see the full error message
const { NAMESPACE } = require('../../src/constants');

// @ts-expect-error TS(2582): Cannot find name 'describe'. Do you need to instal... Remove this comment to see the full error message
describe('getNotiflyUserID', () => {
    // @ts-expect-error TS(2304): Cannot find name 'beforeEach'.
    beforeEach(() => {
        Object.defineProperty(window, 'localStorage', {
            value: {
                // @ts-expect-error TS(2304): Cannot find name 'jest'.
                getItem: jest.fn(),
            },
            writable: true,
        });
    });

    // @ts-expect-error TS(2304): Cannot find name 'afterEach'.
    afterEach(() => {
        // @ts-expect-error TS(2339): Property 'mockRestore' does not exist on type '(ke... Remove this comment to see the full error message
        window.localStorage.getItem.mockRestore();
    });

    // @ts-expect-error TS(2582): Cannot find name 'test'. Do you need to install ty... Remove this comment to see the full error message
    test('should return registered user ID when external user ID is available in localStorage', () => {
        const deviceToken = 'deviceToken';
        const externalUserID = 'externalUserID';
        const expectedUserID = v5(externalUserID, NAMESPACE.REGISTERED_USERID).replace(/-/g, '');

        // @ts-expect-error TS(2339): Property 'mockReturnValue' does not exist on type ... Remove this comment to see the full error message
        window.localStorage.getItem.mockReturnValue(externalUserID);

        const result = getNotiflyUserID(deviceToken);

        // @ts-expect-error TS(2304): Cannot find name 'expect'.
        expect(window.localStorage.getItem).toHaveBeenCalledWith('__notiflyExternalUserID');
        // @ts-expect-error TS(2304): Cannot find name 'expect'.
        expect(result).toBe(expectedUserID);
    });

    // @ts-expect-error TS(2582): Cannot find name 'test'. Do you need to install ty... Remove this comment to see the full error message
    test('should return unregistered user ID when external user ID is not available in localStorage', () => {
        const deviceToken = 'deviceToken';
        const expectedUserID = v5(deviceToken, NAMESPACE.UNREGISTERED_USERID).replace(/-/g, '');

        // @ts-expect-error TS(2339): Property 'mockReturnValue' does not exist on type ... Remove this comment to see the full error message
        window.localStorage.getItem.mockReturnValue(null);

        const result = getNotiflyUserID(deviceToken);

        // @ts-expect-error TS(2304): Cannot find name 'expect'.
        expect(window.localStorage.getItem).toHaveBeenCalledWith('__notiflyExternalUserID');
        // @ts-expect-error TS(2304): Cannot find name 'expect'.
        expect(result).toBe(expectedUserID);
    });
});
