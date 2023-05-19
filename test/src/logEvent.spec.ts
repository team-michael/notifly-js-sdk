import { SDK_VERSION } from '../../src/constants';
import { logEvent } from '../../src/logEvent';
const NOTIFLY_LOG_EVENT_URL = 'https://12lnng07q2.execute-api.ap-northeast-2.amazonaws.com/prod/records';


describe('logEvent', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockLocalStorage: any;
    let mockFetch: jest.Mock;

    beforeEach(() => {
        mockLocalStorage = {
            getItem: jest.fn(),
        };

        mockFetch = jest.fn().mockImplementation(() =>
            Promise.resolve({
                text: jest.fn().mockImplementation(() =>
                    Promise.resolve(JSON.stringify({ message: 'OK' }))
                ),
            })
        );

        Object.defineProperty(window, 'localStorage', {
            value: mockLocalStorage,
        });

        global.fetch = mockFetch;
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it('should log an event and return a Promise', async () => {
        const eventName = 'test_event';
        const eventParams = { foo: 'bar' };
        const segmentationEventParamKeys = ['foo'];
        const isInternalEvent = false;
        const retryCount = 1;

        const notiflyUserID = 'test_user_id';
        const projectID = 'test_project_id';
        const deviceToken = 'test_device_token';
        const cognitoIDToken = 'test_cognito_token';
        const notiflyDeviceID = 'test_device_id';
        const externalUserID = 'test_external_user_id';

        mockLocalStorage.getItem.mockImplementation((key: string) => {
            switch (key) {
                case '__notiflyProjectID':
                    return projectID;
                case '__notiflyDeviceToken':
                    return deviceToken;
                case '__notiflyCognitoIDToken':
                    return cognitoIDToken;
                case '__notiflyDeviceID':
                    return notiflyDeviceID;
                case '__notiflyExternalUserID':
                    return externalUserID;
                default:
                    return null;
            }
        });

        const expectedHeaders = new Headers();
        expectedHeaders.append('Authorization', cognitoIDToken);
        expectedHeaders.append('Content-Type', 'application/json');

        const expectedData = JSON.stringify({
            id: expect.any(String),
            project_id: projectID,
            name: eventName,
            event_params: eventParams,
            notifly_device_id: notiflyDeviceID,
            notifly_user_id: notiflyUserID,
            external_user_id: externalUserID,
            device_token: deviceToken,
            is_internal_event: isInternalEvent,
            segmentationEventParamKeys: segmentationEventParamKeys,
            sdk_version: SDK_VERSION,
            sdk_type: 'js',
            time: expect.any(Number),
            platform: expect.any(String),
        });

        const expectedBody = JSON.stringify({
            records: [
                {
                    data: expectedData,
                    partitionKey: notiflyUserID,
                },
            ],
        });

        const expectedRequestOptions = {
            method: 'POST',
            headers: expectedHeaders,
            body: expectedBody,
            redirect: 'follow' as RequestRedirect,
        };

        const result = await logEvent(
            eventName,
            eventParams,
            segmentationEventParamKeys,
            isInternalEvent,
            retryCount
        );

        expect(mockLocalStorage.getItem).toHaveBeenCalledTimes(6);
        expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
            '__notiflyProjectID'
        );
        expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
            '__notiflyDeviceToken'
        );
        expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
            '__notiflyCognitoIDToken'
        );
        expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
            '__notiflyDeviceID'
        );
        expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
            '__notiflyExternalUserID'
        );
        expect(mockLocalStorage.getItem).toHaveBeenCalledWith(
            '__notiflyUserID'
        );

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
            NOTIFLY_LOG_EVENT_URL,
            expect.objectContaining({
                method: expectedRequestOptions.method,
                headers: expectedRequestOptions.headers,
                redirect: expectedRequestOptions.redirect,
            }) 
        );

        expect(result).toEqual(undefined);
    });
});
