import localForage from 'localforage';
import { SDK_VERSION } from '../../src/constants';
import { logEvent } from '../../src/logEvent';
const NOTIFLY_LOG_EVENT_URL = 'https://12lnng07q2.execute-api.ap-northeast-2.amazonaws.com/prod/records';

jest.mock('localforage', () => ({
    getItem: jest.fn().mockImplementation(() => Promise.resolve(null)),
    setItem: jest.fn().mockImplementation(() => Promise.resolve(null)),
}));

describe('logEvent', () => {
    let mockFetch: jest.Mock;

    beforeEach(() => {
        mockFetch = jest.fn().mockImplementation(() =>
            Promise.resolve({
                text: jest.fn().mockImplementation(() =>
                    Promise.resolve(JSON.stringify({ message: 'OK' }))
                ),
            })
        );

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

        jest.spyOn(localForage, 'getItem').mockImplementation((key: string) => {
            switch (key) {
                case '__notiflyProjectID':
                    return Promise.resolve(projectID);
                case '__notiflyDeviceToken':
                    return Promise.resolve(deviceToken);
                case '__notiflyCognitoIDToken':
                    return Promise.resolve(cognitoIDToken);
                case '__notiflyDeviceID':
                    return Promise.resolve(notiflyDeviceID);
                case '__notiflyExternalUserID':
                    return Promise.resolve(externalUserID);
                default:
                    return Promise.resolve(null);
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

        expect(localForage.getItem).toHaveBeenCalledTimes(6);
        expect(localForage.getItem).toHaveBeenCalledWith(
            '__notiflyProjectID'
        );
        expect(localForage.getItem).toHaveBeenCalledWith(
            '__notiflyDeviceToken'
        );
        expect(localForage.getItem).toHaveBeenCalledWith(
            '__notiflyCognitoIDToken'
        );
        expect(localForage.getItem).toHaveBeenCalledWith(
            '__notiflyDeviceID'
        );
        expect(localForage.getItem).toHaveBeenCalledWith(
            '__notiflyExternalUserID'
        );
        expect(localForage.getItem).toHaveBeenCalledWith(
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
