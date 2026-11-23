import { checkWorkerCompatibility } from '../../src/Core/Storage/WorkerCompatibility';
test('an existing incompatible Notifly worker prevents migration', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
            getRegistrations: async () => [
                {
                    active: { scriptURL: location.origin + '/notifly-service-worker.js', postMessage: () => undefined },
                    scope: location.origin + '/',
                },
            ],
        },
    });
    await expect(checkWorkerCompatibility('/notifly-service-worker.js')).resolves.toBe('blocked');
});
test('unrelated registrations do not enable or block a new Notifly registration', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
            getRegistrations: async () => [
                { active: { scriptURL: location.origin + '/customer-cache.js' }, scope: location.origin + '/' },
            ],
        },
    });
    await expect(checkWorkerCompatibility('/notifly-service-worker.js')).resolves.toBe('not-registered');
});

test('an unrelated filename containing notifly is not treated as the configured worker', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
            getRegistrations: async () => [
                {
                    active: { scriptURL: location.origin + '/unrelated-notifly-analytics.js' },
                    scope: location.origin + '/',
                },
            ],
        },
    });
    await expect(checkWorkerCompatibility('/notifly-service-worker.js')).resolves.toBe('not-registered');
});
test('previous worker evidence and an unknown old custom path require verification', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
            getRegistrations: async () => [
                {
                    active: { scriptURL: location.origin + '/old-sw.js', postMessage: () => undefined },
                    scope: location.origin + '/',
                },
            ],
        },
    });
    await expect((checkWorkerCompatibility as any)('/new-sw.js', true)).resolves.toBe('blocked');
});
