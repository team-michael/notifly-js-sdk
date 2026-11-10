import { NotiflyAPI } from '../../src/Core/API';
import { saveAndGetCognitoIdToken } from '../../src/Core/API/Auth';
import { NotiflyStorage } from '../../src/Core/Storage';

jest.mock('../../src/Core/API/Auth');
jest.mock('../../src/Core/Storage', () => ({
    ...jest.requireActual('../../src/Core/Storage'),
    NotiflyStorage: {
        getItems: jest.fn(),
        getItem: jest.fn(),
    },
}));

describe('API request cancellation', () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    const response = { ok: true, json: async () => ({}) };

    beforeEach(async () => {
        jest.clearAllMocks();
        fetchMock.mockReset().mockResolvedValue(response);
        global.fetch = fetchMock;
        jest.mocked(NotiflyStorage.getItems).mockResolvedValue(['test-user', 'test-placeholder']);
        jest.mocked(NotiflyStorage.getItem).mockResolvedValue('synthetic-token');
        jest.mocked(saveAndGetCognitoIdToken).mockResolvedValue('synthetic-refreshed-token');
        await NotiflyAPI.initialize();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('preserves requests without a cancellation signal', async () => {
        await NotiflyAPI.call('https://example.com/records', 'POST', {});
        expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('signal');
    });

    test('passes the same cancellation signal through HTTP retries', async () => {
        const controller = new AbortController();
        fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
        await NotiflyAPI.call('https://example.com/records', 'POST', {}, 'follow', controller.signal);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        for (const [, request] of fetchMock.mock.calls) {
            expect(request.signal).toBe(controller.signal);
        }
    });

    test('does not start fetch when the request is already cancelled', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(
            NotiflyAPI.call('https://example.com/records', 'POST', {}, 'follow', controller.signal)
        ).rejects.toThrow('aborted');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('cancels an in-flight fetch without starting retries', async () => {
        const controller = new AbortController();
        fetchMock.mockImplementationOnce(
            (_url, request: RequestInit) =>
                new Promise((_resolve, reject) => {
                    request.signal?.addEventListener('abort', () => reject(new Error('synthetic aborted fetch')), {
                        once: true,
                    });
                })
        );
        const result = NotiflyAPI.call('https://example.com/records', 'POST', {}, 'follow', controller.signal);
        controller.abort();
        await expect(result).rejects.toThrow('aborted');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('passes cancellation to token refresh and does not retry after a late refresh', async () => {
        const controller = new AbortController();
        let complete: () => void = () => undefined;
        fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
        jest.mocked(saveAndGetCognitoIdToken).mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    complete = () => resolve('synthetic-refreshed-token');
                })
        );
        const result = NotiflyAPI.call('https://example.com/records', 'POST', {}, 'follow', controller.signal);
        for (let i = 0; i < 5; i++) await Promise.resolve();
        expect(saveAndGetCognitoIdToken).toHaveBeenCalledWith('test-user', 'test-placeholder', controller.signal);
        controller.abort();
        complete();
        await expect(result).rejects.toThrow('aborted');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await NotiflyAPI.call('https://example.com/records', 'POST', {});
        expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer synthetic-token');
    });

    test('does not refresh authentication for a response that arrived after cancellation', async () => {
        const controller = new AbortController();
        let complete: () => void = () => undefined;
        fetchMock.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    complete = () => resolve({ ok: false, status: 401 });
                })
        );
        const result = NotiflyAPI.call('https://example.com/records', 'POST', {}, 'follow', controller.signal);
        controller.abort();
        complete();
        await expect(result).rejects.toThrow('aborted');
        expect(saveAndGetCognitoIdToken).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
