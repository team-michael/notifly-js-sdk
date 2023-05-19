import { v5 } from 'uuid';
import { NAMESPACE } from '../src/constants';
import { saveCognitoIdToken } from '../src/auth';
import { sessionStart } from '../src/logEvent';

import notifly from '../index';

jest.mock('../src/auth');
jest.mock('../src/logEvent');

describe('Notifly SDK', () => {
    describe('initialize', () => {
        const projectID = 'project-id';
        const userName = 'user-name';
        const password = 'password';
        const deviceToken = 'device-token';

        beforeEach(() => {
            (saveCognitoIdToken as jest.MockedFunction<typeof saveCognitoIdToken>).mockClear();
            (sessionStart as jest.MockedFunction<typeof sessionStart>).mockClear();
            localStorage.clear();
        });

        afterEach(() => {
            notifly.resetInitialization();
        });

        it('should return false if any of the required parameters is null', async () => {
            expect(await notifly.initialize(null, userName, password, deviceToken)).toBe(false);
            expect(await notifly.initialize(projectID, null, password, deviceToken)).toBe(false);
            expect(await notifly.initialize(projectID, userName, null, deviceToken)).toBe(false);
        });

        it('should call saveCognitoIdToken with the correct parameters', async () => {
            await notifly.initialize(projectID, userName, password, deviceToken);

            expect(saveCognitoIdToken).toHaveBeenCalledWith(userName, password);
        });

        it('should call _saveNotiflyData with the correct parameters', async () => {
            await notifly.initialize(projectID, userName, password, deviceToken);

            expect(localStorage.getItem('__notiflyProjectID')).toBe(projectID);
            expect(localStorage.getItem('__notiflyUserName')).toBe(userName);
            expect(localStorage.getItem('__notiflyPassword')).toBe(password);
            expect(localStorage.getItem('__notiflyDeviceToken')).toBe(deviceToken);
            expect(localStorage.getItem('__notiflyDeviceID')).toBe(
                v5(deviceToken, NAMESPACE.DEVICEID).replace(/-/g, '')
            );
        });

        it('should not call __notiflyDeviceToken and __notiflyDeviceID when no device token is provided', async () => {
            await notifly.initialize(projectID, userName, password);

            expect(localStorage.getItem('__notiflyProjectID')).toBe(projectID);
            expect(localStorage.getItem('__notiflyUserName')).toBe(userName);
            expect(localStorage.getItem('__notiflyPassword')).toBe(password);
            expect(localStorage.getItem('__notiflyDeviceToken')).toBe(null);
            expect(localStorage.getItem('__notiflyDeviceID')).toBe(null);
        });

        it('should call sessionStart', async () => {
            await notifly.initialize(projectID, userName, password, deviceToken);

            expect(sessionStart).toHaveBeenCalled();
        });

        it('should return true if all the required parameters are not null', async () => {
            expect(await notifly.initialize(projectID, userName, password, deviceToken)).toBe(true);
        });
    });
});
