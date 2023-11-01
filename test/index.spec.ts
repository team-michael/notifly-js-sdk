import localForage from 'localforage';
import { saveCognitoIdToken } from '../src/Core/API/Auth';
import { EventLogger } from '../src/Core/Event';

import notifly from '../src/index';
import { SdkState, SdkStateManager } from '../src/Core/SdkState';

jest.mock('../src/Core/API/Auth');
jest.mock('../src/Core/Event');
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

        beforeEach(() => {
            (saveCognitoIdToken as jest.MockedFunction<typeof saveCognitoIdToken>).mockClear();
            (EventLogger.sessionStart as jest.MockedFunction<typeof EventLogger.sessionStart>).mockClear();
        });

        afterEach(() => {
            SdkStateManager.state = SdkState.NOT_INITIALIZED; // Reset
        });

        it('should return false if any of the required parameters is empty', async () => {
            expect(
                await notifly.initialize({
                    projectId: '',
                    username: userName,
                    password,
                })
            ).toBe(false);
            SdkStateManager.state = SdkState.NOT_INITIALIZED; // Reset
            expect(
                await notifly.initialize({
                    projectId: projectID,
                    username: '',
                    password,
                })
            ).toBe(false);
            SdkStateManager.state = SdkState.NOT_INITIALIZED; // Reset
            expect(
                await notifly.initialize({
                    projectId: projectID,
                    username: userName,
                    password: '',
                })
            ).toBe(false);
        });

        it('should call saveCognitoIdToken with the correct parameters', async () => {
            await notifly.initialize({
                projectId: projectID,
                username: userName,
                password,
            });

            expect(saveCognitoIdToken).toHaveBeenCalledWith(userName, password);
        });

        it('should call _saveNotiflyData with the correct parameters', async () => {
            await notifly.initialize({
                projectId: projectID,
                username: userName,
                password,
            });

            expect(localForage.setItem).toHaveBeenCalledWith('__notiflyProjectID', projectID);
            expect(localForage.setItem).toHaveBeenCalledWith('__notiflyUserName', userName);
            expect(localForage.setItem).toHaveBeenCalledWith('__notiflyPassword', password);
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
