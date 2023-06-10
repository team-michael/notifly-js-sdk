import { getCognitoIdToken } from '../../src/auth';

jest.mock('localforage', () => ({
    config: jest.fn(),
}));

describe('getCognitoIdToken', () => {
    const mockToken = 'mock-token';
    const mockResponse = {
        text: jest.fn(() =>
            Promise.resolve(
                JSON.stringify({
                    AuthenticationResult: {
                        IdToken: mockToken,
                    },
                })
            )
        ),
    };
    const mockFetch = jest.fn(() => Promise.resolve(mockResponse));

    beforeAll(() => {
        global.fetch = mockFetch as jest.Mock;
    });

    afterAll(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global as any).fetch = undefined;
    });

    it('should return a token', async () => {
        const token = await getCognitoIdToken('testUser', 'testPassword');
        const expectedHeaders = new Headers({
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
            'Content-Type': 'application/x-amz-json-1.1',
        });
        expect(token).toEqual(mockToken);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith('https://cognito-idp.ap-northeast-2.amazonaws.com/', {
            method: 'POST',
            headers: expectedHeaders,
            body: JSON.stringify({
                AuthFlow: 'USER_PASSWORD_AUTH',
                AuthParameters: {
                    PASSWORD: 'testPassword',
                    USERNAME: 'testUser',
                },
                ClientId: '2pc5pce21ec53csf8chafknqve',
            }),
            redirect: 'follow',
        });
        expect(mockResponse.text).toHaveBeenCalledTimes(1);
    });

    it('should handle errors', async () => {
        const mockError = new Error('Mock error');
        mockFetch.mockImplementationOnce(() => Promise.reject(mockError));
        const token = await getCognitoIdToken('testUser', 'testPassword');
        expect(token).toEqual('');
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockResponse.text).toHaveBeenCalledTimes(1);
    });
});
