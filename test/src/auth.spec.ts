import { getCognitoIdToken, saveAndGetCognitoIdToken } from '../../src/Core/API/Auth';
import { NotiflyStorage } from '../../src/Core/Storage';

jest.mock('../../src/Core/Storage', () => ({
    ...jest.requireActual('../../src/Core/Storage'),
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

jest.mock('../../src/Core/SdkState', () => ({
    ...jest.requireActual('../../src/Core/SdkState'),
    SdkStateManager: {
        getSdkVersion: jest.fn(() => '1.0.0'),
    },
}));

describe('getCognitoIdToken', () => {
    const mockToken = 'mock-token';
    const mockResponse = {
        json: jest.fn(() =>
            Promise.resolve({
                data: mockToken,
                error: null,
            })
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
        expect(token).toEqual(mockToken);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith('https://api.notifly.tech/authorize', {
            method: 'POST',
            body: JSON.stringify({
                userName: 'testUser',
                password: 'testPassword',
            }),
            headers: {
                'X-Notifly-SDK-Version': 'notifly/js/1.0.0',
            },
        });
        expect(mockResponse.json).toHaveBeenCalledTimes(1);
    });

    it('should handle errors', async () => {
        const mockError = new Error('Mock error');
        mockFetch.mockImplementationOnce(() => Promise.reject(mockError));
        const token = await getCognitoIdToken('testUser', 'testPassword');
        expect(token).toEqual(null);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockResponse.json).toHaveBeenCalledTimes(1);
    });

    it('passes the cancellation signal to the authorization request', async () => {
        const controller = new AbortController();
        await getCognitoIdToken('testUser', 'testPassword', controller.signal);
        expect(mockFetch).toHaveBeenLastCalledWith(
            'https://api.notifly.tech/authorize',
            expect.objectContaining({ signal: controller.signal })
        );
    });

    it('does not persist a token returned after cancellation', async () => {
        const controller = new AbortController();
        let complete: () => void = () => undefined;
        mockResponse.json.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    complete = () => resolve({ data: mockToken, error: null });
                })
        );
        const result = saveAndGetCognitoIdToken('testUser', 'testPassword', controller.signal);
        for (let i = 0; i < 5; i++) await Promise.resolve();
        controller.abort();
        complete();
        await expect(result).resolves.toBeNull();
        expect(NotiflyStorage.setItem).not.toHaveBeenCalled();
    });
});
