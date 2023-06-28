import { getCognitoIdToken } from '../../src/API/Auth';

jest.mock('localforage', () => ({
    config: jest.fn(),
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
        });
        expect(mockResponse.json).toHaveBeenCalledTimes(1);
    });

    it('should handle errors', async () => {
        const mockError = new Error('Mock error');
        mockFetch.mockImplementationOnce(() => Promise.reject(mockError));
        const token = await getCognitoIdToken('testUser', 'testPassword');
        expect(token).toEqual('');
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockResponse.json).toHaveBeenCalledTimes(1);
    });
});
