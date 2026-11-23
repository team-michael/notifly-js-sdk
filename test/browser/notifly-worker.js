/* global importScripts */
// Test-only transport: no production push or API requests leave this worker.
const requests = [];
const notifications = [];
self.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), body: options.body });
    return new Response(
        JSON.stringify(
            String(url).includes('authorize') ? { AuthenticationResult: { IdToken: 'worker-test-token' } } : {}
        ),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
};
Object.defineProperty(self.registration, 'showNotification', {
    value: async (title, options) => {
        notifications.push({ title, options });
    },
});
Object.defineProperty(self.clients, 'matchAll', {
    value: async () => [
        {
            url: self.location.origin,
            focused: true,
            postMessage() {
                return undefined;
            },
        },
    ],
});
importScripts('/dist/NotiflyServiceWorker.js');
self.addEventListener('message', (event) => {
    if (event.data?.type !== '__test_push') return;
    const pending = [];
    const push = new Event('push');
    Object.defineProperty(push, 'data', {
        value: { json: () => ({ notifly: { ti: 'test', bd: 'body', cid: 'campaign', mid: 'message' } }) },
    });
    Object.defineProperty(push, 'waitUntil', { value: (promise) => pending.push(promise) });
    self.dispatchEvent(push);
    const click = new Event('notificationclick');
    Object.defineProperty(click, 'notification', {
        value: {
            close() {
                return undefined;
            },
            data: { campaign_id: 'campaign', notifly_message_id: 'message' },
        },
    });
    Object.defineProperty(click, 'waitUntil', { value: (promise) => pending.push(promise) });
    self.dispatchEvent(click);
    event.waitUntil(Promise.all(pending).then(() => event.ports[0].postMessage({ requests, notifications })));
});
