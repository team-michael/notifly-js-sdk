import { v5 } from 'uuid';
import localForage from 'localforage';
import { NAMESPACE } from '../src/Constants';
import { saveCognitoIdToken } from '../src/API/Auth';
import { sessionStart } from '../src/Event';

import notifly from '../index';

jest.mock('../src/API/Auth');
jest.mock('../src/Event');
jest.mock('localforage', () => ({
    config: jest.fn(),
    getItem: jest.fn().mockImplementation(() => Promise.resolve(null)),
    setItem: jest.fn().mockImplementation(() => Promise.resolve(null)),
}));

describe('Notifly SDK', () => {
    describe('initialize', () => {
        const projectID = 'project-id';
        const userName = 'user-name';
        const password = 'password';
        const deviceToken = 'device-token';

        beforeEach(() => {
            (saveCognitoIdToken as jest.MockedFunction<typeof saveCognitoIdToken>).mockClear();
            (sessionStart as jest.MockedFunction<typeof sessionStart>).mockClear();
        });

        afterEach(() => {
            notifly.resetInitialization();
        });

        it('should return false if any of the required parameters is empty', async () => {
            expect(
                await notifly.initialize({
                    projectId: '',
                    username: userName,
                    password,
                    deviceToken,
                })
            ).toBe(false);
            expect(
                await notifly.initialize({
                    projectId: projectID,
                    username: '',
                    password,
                    deviceToken,
                })
            ).toBe(false);
            expect(
                await notifly.initialize({
                    projectId: projectID,
                    username: userName,
                    password: '',
                    deviceToken,
                })
            ).toBe(false);
        });

        it('should call saveCognitoIdToken with the correct parameters', async () => {
            await notifly.initialize({
                projectId: projectID,
                username: userName,
                password,
                deviceToken,
            });

            expect(saveCognitoIdToken).toHaveBeenCalledWith(userName, password);
        });

        it('should call _saveNotiflyData with the correct parameters', async () => {
            await notifly.initialize({
                projectId: projectID,
                username: userName,
                password,
                deviceToken,
            });

            expect(localForage.setItem).toHaveBeenCalledWith('__notiflyProjectID', projectID);
            expect(localForage.setItem).toHaveBeenCalledWith('__notiflyUserName', userName);
            expect(localForage.setItem).toHaveBeenCalledWith('__notiflyPassword', password);
            expect(localForage.setItem).toHaveBeenCalledWith('__notiflyDeviceToken', deviceToken);
            expect(localForage.setItem).toHaveBeenCalledWith(
                '__notiflyDeviceID',
                v5(deviceToken, NAMESPACE.DEVICEID).replace(/-/g, '')
            );
        });

        it('should not call __notiflyDeviceToken and __notiflyDeviceID when no device token is provided', async () => {
            await notifly.initialize({
                projectId: projectID,
                username: userName,
                password,
            });

            expect(localForage.setItem).toHaveBeenCalledWith('__notiflyProjectID', projectID);
            expect(localForage.setItem).toHaveBeenCalledWith('__notiflyUserName', userName);
            expect(localForage.setItem).toHaveBeenCalledWith('__notiflyPassword', password);
        });

        // it('should call sessionStart', async () => {
        //     await notifly.initialize({
        //         projectId: projectID,
        //         username: userName,
        //         password,
        //         deviceToken,
        //     });

        //     expect(sessionStart).toHaveBeenCalled();
        // });

        // it('should return true if all the required parameters are not null', async () => {
        //     expect(
        //         await notifly.initialize({
        //             projectId: projectID,
        //             username: userName,
        //             password,
        //             deviceToken,
        //         })
        //     ).toBe(true);
        // });
    });
});
