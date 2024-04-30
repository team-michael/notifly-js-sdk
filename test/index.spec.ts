import { NotiflyStorage } from '../src/Core/Storage';
import { saveAndGetCognitoIdToken } from '../src/Core/API/Auth';
import { EventLogger } from '../src/Core/Event';

import notifly from '../src/index';
import { SdkState, SdkStateManager } from '../src/Core/SdkState';

jest.mock('../src/Core/API/Auth');
jest.mock('../src/Core/Event');
jest.mock('../src/Core/Storage', () => ({
    ...jest.requireActual('../src/Core/Storage'),
    NotiflyStorage: {
        ensureInitialized: jest.fn(),
        getItems: jest.fn(),
        getItem: jest.fn(),
        setItems: jest.fn(),
        setItem: jest.fn(),
        removeItems: jest.fn(),
        removeItem: jest.fn(),
    },
}));

describe('Notifly SDK', () => {
    describe('initialize', () => {
        const projectID = 'b80c3f0e2fbd5eb986df4f1d32ea2871';
        const userName = 'user-name';
        const password = 'password';

        beforeEach(() => {
            (saveAndGetCognitoIdToken as jest.MockedFunction<typeof saveAndGetCognitoIdToken>).mockClear();
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

        it('should call _saveNotiflyData with the correct parameters', async () => {
            console.log(projectID);
            await notifly.initialize({
                projectId: projectID,
                username: userName,
                password,
            });

            expect(NotiflyStorage.setItems).toHaveBeenCalledWith({
                __notiflyProjectID: projectID,
                __notiflyUserName: userName,
                __notiflyPassword: password,
            });
        });

        it('should not call __notiflyDeviceToken and __notiflyDeviceID when no device token is provided', async () => {
            await notifly.initialize({
                projectId: projectID,
                username: userName,
                password,
            });
            expect(NotiflyStorage.setItems).not.toHaveBeenCalledWith({
                __notiflyDeviceToken: expect.any(String),
                __notiflyDeviceID: expect.any(String),
            });
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
