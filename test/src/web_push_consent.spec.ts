import type { Campaign } from '../../src/Core/Interfaces/Campaign';
import { SdkState, SdkType } from '../../src/Core/SdkState';

let scheduler: typeof import('../../src/Core/WebMessages/Scheduler').WebMessageScheduler;
let push: typeof import('../../src/Core/Push').NotiflyWebPushManager;
let state: typeof import('../../src/Core/SdkState').SdkStateManager;
let user: typeof import('../../src/Core/User/State').UserStateManager;
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
    renderer = await import('notifly-web-message-renderer');
    const { NotiflyStorage: storage } = await import('../../src/Core/Storage');
    const { EventLogger } = await import('../../src/Core/Event');
    const { NotiflyAPI } = await import('../../src/Core/API');
    jest.spyOn(storage, 'getItem').mockResolvedValue(null);
    jest.spyOn(storage, 'setItem').mockResolvedValue();
    jest.spyOn(storage, 'getItems').mockResolvedValue(['test-project', 'test-device', null]);
    upload = jest.spyOn(NotiflyAPI, 'call').mockResolvedValue({});
    log = jest.spyOn(EventLogger, 'logEvent');
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
    state.state = SdkState.READY;
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

test.each(['denied', 'default'])('preserves consent when browser permission resolves to %s', async (permission) => {
    nativePermission.mockResolvedValue(permission);
    send();
    expect(renderer.getIframe().isConnected).toBe(false);
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

test('records consent for the current user after a login while the popup is open', async () => {
    user.userData.external_user_id = 'another-user';
    const { NotiflyStorage: storage } = await import('../../src/Core/Storage');
    jest.mocked(storage.getItem).mockResolvedValue('another-user');
    jest.mocked(storage.getItems).mockResolvedValue(['test-project', 'test-device', 'another-user']);
    send();
    expect(nativePermission).toHaveBeenCalledTimes(1);
    await flush();
    expect(uploadedEvents().find((event) => event.name === 'set_user_properties')).toMatchObject({
        external_user_id: 'another-user',
        event_params: { $web_push_consent: true },
    });

    expect(renderer.getIframe().isConnected).toBe(false);
});

test('registers a granted subscription for the current user after a login during the permission dialog', async () => {
    let complete: (permission: string) => void = () => undefined;
    nativePermission.mockImplementation(
        () =>
            new Promise((resolve) => {
                complete = resolve;
            })
    );
    send();
    await flush();
    user.userData.external_user_id = 'another-user';
    const { NotiflyStorage: storage } = await import('../../src/Core/Storage');
    jest.mocked(storage.getItem).mockResolvedValue('another-user');
    jest.mocked(storage.getItems).mockResolvedValue(['test-project', 'test-device', 'another-user']);
    complete('granted');
    await flush();
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(uploadedEvents().find((event) => event.name === 'set_device_properties')?.external_user_id).toBe(
        'another-user'
    );
});

test('suppresses a previously scheduled Notifly prompt after direct permission was requested', async () => {
    nativePermission.mockResolvedValue('default');
    send();
    await flush();
    jest.runOnlyPendingTimers();
    expect(document.querySelector('#__notifly_push_prompt_overlay')).toBeNull();
});

test('keeps the popup closed after subscription setup fails without changing consent', async () => {
    subscribe.mockRejectedValue(new Error('synthetic subscription failure'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    send();
    await flush();
    expect(user.userData.user_properties?.$web_push_consent).toBe(true);

    expect(renderer.getIframe().isConnected).toBe(false);
});

test('keeps consent and closes the popup in an unsupported browser', async () => {
    Reflect.deleteProperty(window, 'Notification');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    send();
    await flush();
    expect(user.userData.user_properties?.$web_push_consent).toBe(true);

    expect(nativePermission).not.toHaveBeenCalled();
    expect(renderer.getIframe().isConnected).toBe(false);
});

test('registers the subscription for the current user if the user changes while subscribing', async () => {
    const { NotiflyStorage: storage } = await import('../../src/Core/Storage');
    subscribe.mockImplementation(async () => {
        user.userData.external_user_id = 'another-user';
        jest.mocked(storage.getItem).mockResolvedValue('another-user');
        jest.mocked(storage.getItems).mockResolvedValue(['test-project', 'test-device', 'another-user']);
        return { endpoint: 'https://push.example.com/subscription' };
    });
    send();
    await flush();
    expect(uploadedEvents().find((event) => event.name === 'set_device_properties')?.external_user_id).toBe(
        'another-user'
    );
});

test('records the current click time when a new popup requests permission', async () => {
    nativePermission.mockResolvedValue('default');
    send();
    await flush();
    jest.setSystemTime(new Date('2026-11-06T01:05:03.000Z'));
    scheduler.scheduleInWebMessage(campaign);
    send({ type: '__notifly_web_message_loaded' });
    await flush();
    send();
    await flush();
    expect(nativePermission).toHaveBeenCalledTimes(2);
    expect(user.userData.user_properties?.$web_push_consented_at).toBe('2026-11-06T01:05:03.000Z');
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

test('uses the stored user for consent and subscription after another tab changes it', async () => {
    const { NotiflyStorage: storage } = await import('../../src/Core/Storage');
    jest.spyOn(storage, 'getItem').mockResolvedValue('user-from-another-tab');
    jest.spyOn(storage, 'getItems').mockResolvedValue(['test-project', 'test-device', 'user-from-another-tab']);
    send();
    expect(nativePermission).toHaveBeenCalledTimes(1);
    await flush();
    expect(user.userData.user_properties?.$web_push_consent).toBe(true);
    const events = uploadedEvents();
    expect(events.find((event) => event.name === 'set_user_properties')?.external_user_id).toBe(
        'user-from-another-tab'
    );
    expect(events.find((event) => event.name === 'set_device_properties')?.external_user_id).toBe(
        'user-from-another-tab'
    );
});

test.each([
    [SdkType.JS, 'set_user_properties'],
    [SdkType.JS_CAFE24, 'set_user_properties'],
    [SdkType.JS, 'set_device_properties'],
])('closes immediately despite a failed upload (%s, %s)', async (sdkType, failedEvent) => {
    state.type = sdkType as SdkType;
    upload.mockImplementation(async (_url, _method, body) => {
        if (JSON.parse(body.records[0].data).name === failedEvent) {
            throw new Error('synthetic event upload failure');
        }
        return {};
    });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    send();
    expect(nativePermission).toHaveBeenCalledTimes(1);
    await flush();
    expect(uploadedEvents().some((event) => event.name === failedEvent)).toBe(true);
    expect(user.userData.user_properties?.$web_push_consent).toBe(true);

    expect(renderer.getIframe().isConnected).toBe(false);
});

test('does not overwrite the new user when an earlier consent upload completes', async () => {
    let complete: () => void = () => undefined;
    upload.mockImplementation((_url, _method, body) => {
        if (JSON.parse(body.records[0].data).name === 'set_user_properties') {
            return new Promise((resolve) => {
                complete = () => resolve({});
            });
        }
        return Promise.resolve({});
    });
    nativePermission.mockResolvedValue('default');
    send();
    await flush();
    user.userData = { ...user.userData, external_user_id: 'new-user', user_properties: {} };
    const { NotiflyStorage: storage } = await import('../../src/Core/Storage');
    jest.spyOn(storage, 'getItem').mockResolvedValue('new-user');
    complete();
    await flush();
    expect(user.userData.user_properties).toEqual({});
});

test.each(['set_user_properties', 'set_device_properties'])(
    'does not wait for a stalled %s upload before closing',
    async (stalledEvent) => {
        upload.mockImplementation((_url, _method, body) => {
            if (JSON.parse(body.records[0].data).name === stalledEvent) return new Promise(() => undefined);
            return Promise.resolve({});
        });
        send();
        expect(nativePermission).toHaveBeenCalledTimes(1);
        await flush();
        expect(uploadedEvents().some((event) => event.name === stalledEvent)).toBe(true);
        expect(user.userData.user_properties?.$web_push_consent).toBe(true);

        expect(renderer.getIframe().isConnected).toBe(false);
    }
);

test('closes before the permission decision and leaves the next popup open when it completes', async () => {
    let complete: () => void = () => undefined;
    let popupOpenWhenPermissionStarts = false;
    nativePermission.mockImplementation(
        () =>
            new Promise((resolve) => {
                popupOpenWhenPermissionStarts = renderer.getIframe().isConnected;
                complete = () => resolve('granted');
            })
    );
    const response = captureResponses();
    send();
    expect(nativePermission).toHaveBeenCalledTimes(1);
    expect(popupOpenWhenPermissionStarts).toBe(true);
    expect(renderer.getIframe().isConnected).toBe(false);
    await flush();
    expect(user.userData.user_properties?.$web_push_consent).toBe(true);
    expect(subscribe).not.toHaveBeenCalled();
    expect(response).not.toHaveBeenCalled();

    scheduler.scheduleInWebMessage({ ...campaign, id: 'next-campaign' });
    send({ type: '__notifly_web_message_loaded' });
    await flush();
    expect(renderer.getIframe().isConnected).toBe(true);
    complete();
    await flush();
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(renderer.getIframe().isConnected).toBe(true);
});

test('keeps the popup closed if the native permission request rejects', async () => {
    nativePermission.mockRejectedValue(new Error('synthetic permission failure'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    send();
    expect(renderer.getIframe().isConnected).toBe(false);
    await flush();
    expect(subscribe).not.toHaveBeenCalled();
    expect(user.userData.user_properties?.$web_push_consent).toBe(true);
});

describe('without web push configured on the site', () => {
    beforeAll(() => {
        webPushConfigured = false;
    });
    afterAll(() => {
        webPushConfigured = true;
    });

    test('keeps consent and closes without web push configured', async () => {
        send();
        await flush();
        send();
        await flush();
        expect(nativePermission).not.toHaveBeenCalled();
        expect(user.userData.user_properties?.$web_push_consent).toBe(true);
    });
});

describe('popup action handler', () => {
    let notifly: typeof import('../../src').default;

    beforeEach(async () => {
        notifly = (await import('../../src')).default;
    });

    afterEach(() => {
        notifly.setPopupActionHandler(null);
    });

    test('registers before initialization, replaces the handler, and clears it with null', async () => {
        state.state = SdkState.NOT_INITIALIZED;
        const first = jest.fn();
        const second = jest.fn();
        notifly.setPopupActionHandler(first);
        notifly.setPopupActionHandler(second);
        state.state = SdkState.READY;
        notification.permission = 'denied';
        send();
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledWith({
            type: 'web_push_consent',
            campaignId: 'consent-campaign',
            buttonName: 'agree',
        });
        await flush();
        notifly.setPopupActionHandler(null);
        scheduler.scheduleInWebMessage(campaign);
        send({ type: '__notifly_web_message_loaded' });
        await flush();
        send();
        await flush();
        expect(second).toHaveBeenCalledTimes(1);
        expect(user.userData.user_properties?.$web_push_consent).toBe(true);
    });

    test.each([
        [
            { type: 'main_button', buttonName: 'visit', link: 'https://example.com/page' },
            { type: 'click', buttonName: 'visit', url: 'https://example.com/page' },
        ],
        [
            { type: 'main_button', link: 'myapp://page' },
            { type: 'click', url: 'myapp://page' },
        ],
        [{ type: 'main_button', buttonName: 42, link: null }, { type: 'click' }],
        [
            { type: 'close', buttonName: 'close' },
            { type: 'close', buttonName: 'close' },
        ],
        [
            { type: 'close', extraData: { data: { hideUntil: 2000000000 } } },
            { type: 'hide', hideUntil: 2000000000 },
        ],
        [{ type: 'close', extraData: { data: { hideUntil: 'tomorrow' } } }, { type: 'close' }],
        [{ type: 'close', extraData: { data: { hideUntil: 0 } } }, { type: 'close' }],
        [{ type: 'close', extraData: { data: { hideUntil: Infinity } } }, { type: 'close' }],
    ])('reports the action and preserves the default close: %j', async (message, expected) => {
        jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
        const handler = jest.fn();
        notifly.setPopupActionHandler(handler);
        send({ ...message, unrelated: { privateValue: 'not-for-callback' } });
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({ campaignId: 'consent-campaign', ...expected });
        expect(renderer.getIframe().isConnected).toBe(false);
        await flush();
        expect(log).toHaveBeenCalledWith(
            message.type === 'main_button' ? 'main_button_click' : 'close_button_click',
            expect.objectContaining({ campaign_id: 'consent-campaign' }),
            null,
            true
        );
        if (expected.type === 'hide') {
            expect(user.userData.user_properties?.hide_in_web_message_consent).toBe(2000000000);
        }
    });

    test.each(['blank', 'self'] as const)(
        'preserves %s navigation order without awaiting the callback',
        async (mode) => {
            send({ type: 'close' });
            await flush();
            scheduler.scheduleInWebMessage({
                ...campaign,
                message: {
                    ...campaign.message,
                    modal_properties: { ...campaign.message.modal_properties, link_open_mode: mode },
                },
            });
            send({ type: '__notifly_web_message_loaded' });
            await flush();
            const order: string[] = [];
            jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
                expect(this.href).toBe('https://example.com/page');
                order.push('navigate');
            });
            notifly.setPopupActionHandler(() => {
                order.push('handler');
                return new Promise<void>(() => undefined);
            });
            send({ type: 'main_button', link: 'https://example.com/page' });
            expect(order).toEqual(mode === 'blank' ? ['navigate', 'handler'] : ['handler']);
            await flush();
            expect(order).toEqual(mode === 'blank' ? ['navigate', 'handler'] : ['handler', 'navigate']);
        }
    );

    test.each(['throw', 'reject'])('keeps navigation and logging when the handler fails: %s', async (failure) => {
        const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const navigate = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
        notifly.setPopupActionHandler(() => {
            if (failure === 'throw') throw new Error('customer callback failed');
            return Promise.reject(new Error('customer callback failed'));
        });
        send({ type: 'main_button', link: 'https://example.com/page' });
        await flush();
        expect(renderer.getIframe().isConnected).toBe(false);
        expect(navigate).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledWith('main_button_click', expect.any(Object), null, true);
        expect(errors).toHaveBeenCalledTimes(1);
    });

    test('starts permission before notifying once and does not wait for the handler', async () => {
        const observations: Array<{ permissionCalls: number; popupOpen: boolean }> = [];
        const handler = jest.fn(() => {
            observations.push({
                permissionCalls: nativePermission.mock.calls.length,
                popupOpen: renderer.getIframe().isConnected,
            });
            return new Promise<void>(() => undefined);
        });
        notifly.setPopupActionHandler(handler);
        send();
        send();
        expect(handler).toHaveBeenCalledTimes(1);
        expect(observations).toEqual([{ permissionCalls: 1, popupOpen: false }]);
        await flush();

        expect(renderer.getIframe().isConnected).toBe(false);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    test.each(['not_ready', 'interaction_required'])(
        'reports the action even if permission cannot start: %s',
        (status) => {
            if (status === 'not_ready') state.state = SdkState.REFRESHING;
            else activation.isActive = false;
            const handler = jest.fn();
            notifly.setPopupActionHandler(handler);
            send();
            expect(handler).toHaveBeenCalledWith({
                type: 'web_push_consent',
                campaignId: 'consent-campaign',
                buttonName: 'agree',
            });
            expect(nativePermission).not.toHaveBeenCalled();
            expect(renderer.getIframe().isConnected).toBe(false);
        }
    );

    test('ignores control, malformed, custom, and foreign-frame messages', () => {
        const handler = jest.fn();
        notifly.setPopupActionHandler(handler);
        for (const data of [null, 'close', [], { type: '__notifly_web_message_loaded' }, { type: 'custom' }])
            send(data);
        send({ type: 'main_button' }, window);
        send({ type: 'close' }, null);
        expect(handler).not.toHaveBeenCalled();
    });

    test('retains the handler for the next popup', async () => {
        const handler = jest.fn();
        notifly.setPopupActionHandler(handler);
        send({ type: 'close' });
        await flush();
        scheduler.scheduleInWebMessage({ ...campaign, id: 'next-campaign' });
        send({ type: '__notifly_web_message_loaded' });
        await flush();
        send({ type: 'main_button' });
        expect(handler.mock.calls).toEqual([
            [{ type: 'close', campaignId: 'consent-campaign' }],
            [{ type: 'click', campaignId: 'next-campaign' }],
        ]);
    });
});
