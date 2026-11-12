import type { Campaign } from '../../src/Core/Interfaces/Campaign';
import { SdkType } from '../../src/Core/SdkState';

let scheduler: typeof import('../../src/Core/WebMessages/Scheduler').WebMessageScheduler;
let push: typeof import('../../src/Core/Push').NotiflyWebPushManager;
let state: typeof import('../../src/Core/SdkState').SdkStateManager;
let user: typeof import('../../src/Core/User/State').UserStateManager;
let identity: typeof import('../../src/Core/User').UserIdentityManager;
let renderer: typeof import('notifly-web-message-renderer');
let log: jest.SpyInstance;
let upload: jest.SpyInstance;
let nativePermission: jest.Mock;
let subscribe: jest.Mock;
let notification: { permission: NotificationPermission; requestPermission: jest.Mock };
let activation: { isActive: boolean };
let webPushConfigured = true;
const descriptors = {
    notification: Object.getOwnPropertyDescriptor(window, 'Notification'),
    worker: Object.getOwnPropertyDescriptor(navigator, 'serviceWorker'),
    activation: Object.getOwnPropertyDescriptor(navigator, 'userActivation'),
};
const flush = async () => {
    for (let i = 0; i < 60; i++) await Promise.resolve();
};
const uploadedEvents = (): Array<{ name: string; external_user_id?: string; event_params: Record<string, unknown> }> =>
    upload.mock.calls.map(([, , body]) => JSON.parse(body.records[0].data));
const captureResponses = () => {
    const popupWindow = renderer.getIframe().contentWindow;
    if (!popupWindow) throw new Error('Missing test popup window');
    return jest.spyOn(popupWindow, 'postMessage');
};
const send = (data: unknown = { type: 'web_push_consent', buttonName: 'agree' }, source?: MessageEventSource | null) =>
    window.dispatchEvent(
        new MessageEvent('message', {
            source: source === undefined ? renderer.getIframe().contentWindow : source,
            data,
        })
    );
const campaign: Campaign = {
    id: 'consent-campaign',
    channel: 'in-web-message',
    status: 1,
    updated_at: '2026-11-06T00:00:00Z',
    starts: [1],
    segment_type: 'condition',
    triggering_conditions: [],
    message: {
        html_url: 'https://cdn.example.com/consent.html',
        modal_properties: {
            version: 3,
            template_name: 'consent',
            modal_props_narrow: { position: 'fixed' },
            modal_props_wide: { position: 'fixed' },
        },
    },
};

beforeEach(async () => {
    jest.resetModules();
    jest.useFakeTimers().setSystemTime(new Date('2026-11-06T01:02:03.000Z'));
    ({ WebMessageScheduler: scheduler } = await import('../../src/Core/WebMessages/Scheduler'));
    ({ NotiflyWebPushManager: push } = await import('../../src/Core/Push'));
    ({ SdkStateManager: state } = await import('../../src/Core/SdkState'));
    ({ UserStateManager: user } = await import('../../src/Core/User/State'));
    ({ UserIdentityManager: identity } = await import('../../src/Core/User'));
    renderer = await import('notifly-web-message-renderer');
    const { NotiflyStorage: storage } = await import('../../src/Core/Storage');
    const { EventLogger } = await import('../../src/Core/Event');
    const { NotiflyAPI } = await import('../../src/Core/API');
    jest.spyOn(storage, 'getItem').mockResolvedValue(null);
    jest.spyOn(storage, 'setItem').mockResolvedValue();
    jest.spyOn(storage, 'getItems').mockResolvedValue(['test-project', 'test-device', null]);
    upload = jest.spyOn(NotiflyAPI, 'call').mockResolvedValue({});
    log = jest.spyOn(EventLogger, 'logEvent').mockResolvedValue();
    nativePermission = jest.fn().mockResolvedValue('granted');
    subscribe = jest.fn().mockResolvedValue({ endpoint: 'https://push.example.com/subscription' });
    notification = { permission: 'default', requestPermission: nativePermission };
    activation = { isActive: true };
    Object.defineProperty(window, 'Notification', { configurable: true, value: notification });
    Object.defineProperty(navigator, 'userActivation', { configurable: true, value: activation });
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
            register: jest
                .fn()
                .mockResolvedValue({ pushManager: { getSubscription: jest.fn().mockResolvedValue(null), subscribe } }),
            addEventListener: jest.fn(),
        },
    });
    state.state = 1;
    user.userData = { platform: 'web', sdk_type: 'js', sdk_version: '2.21.0' };
    if (webPushConfigured) await push.initialize('AQID', true);
    scheduler.scheduleInWebMessage(campaign);
    send({ type: '__notifly_web_message_loaded' });
    await flush();
    log.mockClear();
    upload.mockClear();
});

afterEach(async () => {
    send({ type: 'close' });
    await flush();
    scheduler.descheduleInWebMessage();
    renderer.dispose();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    for (const [target, name, descriptor] of [
        [window, 'Notification', descriptors.notification],
        [navigator, 'serviceWorker', descriptors.worker],
        [navigator, 'userActivation', descriptors.activation],
    ] as const) {
        if (descriptor) Object.defineProperty(target, name, descriptor);
        else Reflect.deleteProperty(target, name);
    }
});

test('records anonymous consent and requests native permission without the Notifly prompt', async () => {
    send();
    expect(nativePermission).toHaveBeenCalledTimes(1);
    expect(document.querySelector('#__notifly_push_prompt_overlay')).toBeNull();
    await flush();
    expect(user.userData.user_properties).toMatchObject({
        $web_push_consent: true,
        $web_push_consented_at: '2026-11-06T01:02:03.000Z',
    });
    expect(uploadedEvents()).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                name: 'set_user_properties',
                event_params: {
                    $web_push_consent: true,
                    $web_push_consented_at: '2026-11-06T01:02:03.000Z',
                },
            }),
            expect.objectContaining({
                name: 'set_device_properties',
                event_params: { device_token: expect.any(String) },
            }),
        ])
    );
    expect(subscribe).toHaveBeenCalledTimes(1);
});

test('does not await consent persistence before requesting browser permission', async () => {
    let complete: () => void = () => undefined;
    jest.spyOn(identity, 'setUserPropertiesWithResult').mockImplementation(
        () =>
            new Promise<'sent'>((resolve) => {
                complete = () => resolve('sent');
            })
    );
    send();
    expect(nativePermission).toHaveBeenCalledTimes(1);
    complete();
    await flush();
});

test.each(['denied', 'default'])('preserves consent when browser permission resolves to %s', async (permission) => {
    nativePermission.mockResolvedValue(permission);
    send();
    await flush();
    expect(user.userData.user_properties?.$web_push_consent).toBe(true);
    expect(subscribe).not.toHaveBeenCalled();
});

test('does not prompt again when browser permission is already granted', async () => {
    notification.permission = 'granted';
    send();
    await flush();
    expect(nativePermission).not.toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(1);
});

test('records consent but does not re-prompt an already denied browser', async () => {
    notification.permission = 'denied';
    send();
    await flush();
    expect(nativePermission).not.toHaveBeenCalled();
    expect(user.userData.user_properties?.$web_push_consent).toBe(true);
});

test('ignores duplicate clicks while the browser request is pending', async () => {
    send();
    send();
    expect(nativePermission).toHaveBeenCalledTimes(1);
    await flush();
    expect(subscribe).toHaveBeenCalledTimes(1);
});

test('requires a recent real user interaction and the current popup source', async () => {
    send(undefined, window);
    send(undefined, null);
    activation.isActive = false;
    send();
    await flush();
    expect(nativePermission).not.toHaveBeenCalled();
    expect(user.userData.user_properties?.$web_push_consent).toBeUndefined();
});

test('does not accept consent from a popup belonging to the previous user', async () => {
    user.userData.external_user_id = 'another-user';
    send();
    await flush();
    expect(nativePermission).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
});

test('registers a granted subscription for the current user after a login during the permission dialog', async () => {
    let complete: (permission: string) => void = () => undefined;
    nativePermission.mockImplementation(
        () =>
            new Promise((resolve) => {
                complete = resolve;
            })
    );
    const response = captureResponses();
    send();
    await flush();
    user.userData.external_user_id = 'another-user';
    complete('granted');
    await flush();
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(uploadedEvents().some((event) => event.name === 'set_device_properties')).toBe(true);
    expect(response).toHaveBeenCalledWith(expect.objectContaining({ status: 'identity_changed' }), '*');
});

test('suppresses a previously scheduled Notifly prompt after direct permission was requested', async () => {
    nativePermission.mockResolvedValue('default');
    send();
    await flush();
    jest.runOnlyPendingTimers();
    expect(document.querySelector('#__notifly_push_prompt_overlay')).toBeNull();
});

test('reports failed subscription setup without changing the consent decision', async () => {
    subscribe.mockRejectedValue(new Error('synthetic subscription failure'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    send();
    await flush();
    expect(user.userData.user_properties?.$web_push_consent).toBe(true);
});

test('keeps consent in an unsupported browser and reports the result', async () => {
    Reflect.deleteProperty(window, 'Notification');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const response = captureResponses();
    send();
    await flush();
    expect(user.userData.user_properties?.$web_push_consent).toBe(true);
    expect(response).toHaveBeenCalledWith(expect.objectContaining({ status: 'unsupported' }), '*');
    expect(nativePermission).not.toHaveBeenCalled();
});

test('waits for the open browser prompt when the consent storage read fails, then allows a retry', async () => {
    let complete: (permission: string) => void = () => undefined;
    nativePermission.mockImplementation(
        () =>
            new Promise((resolve) => {
                complete = resolve;
            })
    );
    const { NotiflyStorage: storage } = await import('../../src/Core/Storage');
    jest.mocked(storage.getItem).mockRejectedValueOnce(new Error('synthetic storage timeout'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = captureResponses();
    send();
    expect(nativePermission).toHaveBeenCalledTimes(1);
    await flush();
    expect(response).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: '__notifly_web_push_consent_result' }),
        '*'
    );
    notification.permission = 'granted';
    complete('granted');
    await flush();
    expect(response).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }), '*');
    expect(renderer.getIframe().isConnected).toBe(true);
    send();
    await flush();
    expect(response).toHaveBeenCalledWith(expect.objectContaining({ status: 'granted' }), '*');
    expect(user.userData.user_properties?.$web_push_consent).toBe(true);
});

test('registers the subscription for the current user if the user changes while subscribing', async () => {
    subscribe.mockImplementation(async () => {
        user.userData.external_user_id = 'another-user';
        return { endpoint: 'https://push.example.com/subscription' };
    });
    const response = captureResponses();
    send();
    await flush();
    expect(uploadedEvents().some((event) => event.name === 'set_device_properties')).toBe(true);
    expect(response).toHaveBeenCalledWith(expect.objectContaining({ status: 'identity_changed' }), '*');
});

test('retries with the same consent timestamp after dismissing browser permission', async () => {
    nativePermission.mockResolvedValue('default');
    send();
    await flush();
    jest.setSystemTime(new Date('2026-11-06T01:05:03.000Z'));
    send();
    await flush();
    expect(nativePermission).toHaveBeenCalledTimes(2);
    expect(user.userData.user_properties?.$web_push_consented_at).toBe('2026-11-06T01:02:03.000Z');
});

test('repeats the compatibility acknowledgement when reused popup content finishes loading', async () => {
    send({ type: 'close' });
    await flush();
    scheduler.scheduleInWebMessage(campaign);
    await flush();
    const response = captureResponses();
    response.mockClear();
    log.mockClear();
    upload.mockClear();
    send({ type: '__notifly_web_message_loaded' });
    await flush();
    expect(response).toHaveBeenCalledWith({ type: '__notifly_web_push_consent_ready' }, '*');
    expect(log).not.toHaveBeenCalled();
});

test('keeps consent off but registers the subscription for the stored user after another tab changes it', async () => {
    const { NotiflyStorage: storage } = await import('../../src/Core/Storage');
    jest.spyOn(storage, 'getItem').mockResolvedValue('user-from-another-tab');
    jest.spyOn(storage, 'getItems').mockResolvedValue(['test-project', 'test-device', 'user-from-another-tab']);
    const response = captureResponses();
    send();
    expect(nativePermission).toHaveBeenCalledTimes(1);
    await flush();
    expect(user.userData.user_properties?.$web_push_consent).toBeUndefined();
    const events = uploadedEvents();
    expect(events.some((event) => event.name === 'set_user_properties')).toBe(false);
    expect(events.find((event) => event.name === 'set_device_properties')?.external_user_id).toBe(
        'user-from-another-tab'
    );
    expect(response).toHaveBeenCalledWith(expect.objectContaining({ status: 'identity_changed' }), '*');
});

test.each(['set_user_properties', 'set_device_properties'])(
    'reports failed %s uploads instead of closing the popup as granted',
    async (failedEvent) => {
        upload.mockImplementation(async (_url, _method, body) => {
            if (JSON.parse(body.records[0].data).name === failedEvent) {
                throw new Error('synthetic event upload failure');
            }
            return {};
        });
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const response = captureResponses();
        send();
        expect(nativePermission).toHaveBeenCalledTimes(1);
        await flush();
        expect(response).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }), '*');
        expect(response).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'granted' }), '*');
        expect(renderer.getIframe().isConnected).toBe(true);
    }
);

test.each([SdkType.JS, SdkType.JS_CAFE24])(
    'retries failed consent immediately with the same timestamp for %s',
    async (sdkType) => {
        state.type = sdkType;
        nativePermission.mockResolvedValue('default');
        upload.mockRejectedValueOnce(new Error('synthetic consent upload failure'));
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const response = captureResponses();
        send();
        await flush();
        expect(response).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }), '*');
        expect(user.userData.user_properties?.$web_push_consent).toBeUndefined();
        send();
        await flush();
        expect(upload).toHaveBeenCalledTimes(2);
        const properties = upload.mock.calls.map(([, , body]) => JSON.parse(body.records[0].data).event_params);
        expect(properties[1]).toEqual(properties[0]);
        expect(user.userData.user_properties).toMatchObject({
            $web_push_consent: true,
            $web_push_consented_at: '2026-11-06T01:02:03.000Z',
        });
        expect(response).toHaveBeenCalledWith(expect.objectContaining({ status: 'dismissed' }), '*');
    }
);

test('does not apply acknowledged consent to a user who changed while the upload was pending', async () => {
    let complete: () => void = () => undefined;
    upload.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                complete = () => resolve({});
            })
    );
    nativePermission.mockResolvedValue('default');
    const response = captureResponses();
    send();
    await flush();
    user.userData = { ...user.userData, external_user_id: 'new-user', user_properties: {} };
    const { NotiflyStorage: storage } = await import('../../src/Core/Storage');
    jest.spyOn(storage, 'getItem').mockResolvedValue('new-user');
    complete();
    await flush();
    expect(user.userData.user_properties).toEqual({});
    expect(response).toHaveBeenCalledWith(expect.objectContaining({ status: 'identity_changed' }), '*');
});

test.each(['set_user_properties', 'set_device_properties'])(
    'times out a stalled %s upload and allows a successful retry',
    async (stalledEvent) => {
        let complete: () => void = () => undefined;
        let requestSignal: AbortSignal | undefined;
        let stalled = false;
        upload.mockImplementation((_url, _method, body, _redirect, signal) => {
            if (!stalled && JSON.parse(body.records[0].data).name === stalledEvent) {
                stalled = true;
                requestSignal = signal;
                return new Promise((resolve) => {
                    complete = () => resolve({});
                });
            }
            return Promise.resolve({});
        });
        const response = captureResponses();
        send();
        expect(nativePermission).toHaveBeenCalledTimes(1);
        await flush();
        jest.advanceTimersByTime(9999);
        await flush();
        expect(response).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: '__notifly_web_push_consent_result' }),
            '*'
        );
        jest.advanceTimersByTime(1);
        await flush();
        expect(response).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }), '*');
        expect(requestSignal?.aborted).toBe(true);
        expect(renderer.getIframe().isConnected).toBe(true);
        if (stalledEvent === 'set_user_properties') {
            expect(user.userData.user_properties?.$web_push_consent).toBeUndefined();
        }
        complete();
        await flush();
        if (stalledEvent === 'set_user_properties') {
            expect(user.userData.user_properties?.$web_push_consent).toBeUndefined();
        }
        notification.permission = 'granted';
        send();
        await flush();
        expect(response).toHaveBeenCalledWith(expect.objectContaining({ status: 'granted' }), '*');
        expect(user.userData.user_properties?.$web_push_consented_at).toBe('2026-11-06T01:02:03.000Z');
    }
);

test('keeps the native permission dialog pending without applying the server upload deadline to it', async () => {
    let complete: () => void = () => undefined;
    nativePermission.mockImplementation(
        () =>
            new Promise((resolve) => {
                complete = () => resolve('granted');
            })
    );
    const response = captureResponses();
    send();
    await flush();
    jest.advanceTimersByTime(20000);
    await flush();
    expect(response).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: '__notifly_web_push_consent_result' }),
        '*'
    );
    expect(user.userData.user_properties?.$web_push_consent).toBe(true);
    complete();
    await flush();
    expect(response).toHaveBeenCalledWith(expect.objectContaining({ status: 'granted' }), '*');
});

test.each([
    ['clears the user ID with an empty string', ''],
    ['repeats a stored user ID that has surrounding spaces', ' padded-user '],
])('accepts consent after the site %s', async (_case, userId) => {
    const { NotiflyStorage: storage, NotiflyStorageKeys: keys } = await import('../../src/Core/Storage');
    const stored: Record<string, string> = {
        [keys.PROJECT_ID]: 'test-project',
        [keys.NOTIFLY_DEVICE_ID]: 'test-device',
    };
    if (userId) stored[keys.EXTERNAL_USER_ID] = userId;
    jest.spyOn(storage, 'getItem').mockImplementation(async (key) => stored[key] ?? null);
    jest.spyOn(storage, 'getItems').mockImplementation(async (requested) =>
        requested.map((key) => stored[key] ?? null)
    );
    await user.updateExternalUserId();
    await identity.setUserId(userId);
    send({ type: 'close' });
    await flush();
    scheduler.scheduleInWebMessage(campaign);
    send({ type: '__notifly_web_message_loaded' });
    await flush();
    const response = captureResponses();
    send();
    await flush();
    expect(response).toHaveBeenCalledWith(expect.objectContaining({ status: 'granted' }), '*');
});

describe('without web push configured on the site', () => {
    beforeAll(() => {
        webPushConfigured = false;
    });
    afterAll(() => {
        webPushConfigured = true;
    });

    test('keeps consent and reports unsupported instead of asking the visitor to retry', async () => {
        const response = captureResponses();
        send();
        await flush();
        send();
        await flush();
        expect(nativePermission).not.toHaveBeenCalled();
        expect(user.userData.user_properties?.$web_push_consent).toBe(true);
        expect(response).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'not_ready' }), '*');
        expect(response).toHaveBeenCalledWith(expect.objectContaining({ status: 'unsupported' }), '*');
    });
});
