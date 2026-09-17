import { tech } from 'notifly-core-sdk';
import { dispose, getIframe } from 'notifly-web-message-renderer';
import { Campaign, CampaignStatus } from '../../src/Core/Interfaces/Campaign';
import { NotiflyStorage, NotiflyStorageKeys } from '../../src/Core/Storage';
import { SdkState, SdkStateManager } from '../../src/Core/SdkState';
import { WebMessageScheduler } from '../../src/Core/WebMessages/Scheduler';
import { WebMessageManager } from '../../src/Core/WebMessages/Manager';
import { UserStateManager } from '../../src/Core/User/State';
import { EventLogger, NotiflyInternalEvent } from '../../src/Core/Event';

type Input = tech.notifly.kmp.popup.model.PopupRenderInput;
type Output = tech.notifly.kmp.popup.model.PopupRenderOutput;
const projectId = '0123456789abcdef0123456789abcdef';
const deviceId = '12345678-1234-4234-8234-123456789abc';
const sourceUrl = 'https://cdn.notifly.tech/web/example/index.html';
const html = '<!doctype html><html><head></head><body><p>Hello personalized user</p></body></html>';
const flush = async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
};
const campaign = (mode: string | undefined = 'ssr', delay = 0): Campaign => ({
    id: 'campaign-1',
    channel: 'in-web-message',
    status: CampaignStatus.ACTIVE,
    updated_at: '2026-09-18T00:00:00Z',
    starts: [1],
    segment_type: 'condition',
    delay,
    triggering_conditions: [[{ type: 'event_name', operator: '=', operand: 'purchase' }]],
    message: {
        html_url: sourceUrl,
        template_rendering_mode: mode,
        modal_properties: {
            version: 3,
            template_name: 'personalized',
            modal_props_narrow: { position: 'fixed' },
            modal_props_wide: { position: 'fixed' },
        },
    },
});

let identity: Record<string, string | null>;
let requests: { input: Input; complete: (output: Output) => void; cancel: jest.Mock }[];
let configs: tech.notifly.kmp.popup.model.PopupRendererConfig[];
let log: jest.SpyInstance;
const complete = (index = 0, outcome = 'rendered') =>
    requests[index].complete({
        outcome,
        html: outcome === 'rendered' ? html : null,
        errorCode: outcome === 'failed' ? 'render_failed' : null,
        httpStatus: outcome === 'rendered' ? 200 : null,
    });
const loaded = () =>
    window.dispatchEvent(
        new MessageEvent('message', {
            source: getIframe().contentWindow,
            data: { type: '__notifly_web_message_loaded' },
        })
    );
const visibleFrame = () => document.querySelector<HTMLIFrameElement>('#--notifly-web-message-iframe');

beforeEach(() => {
    jest.useFakeTimers();
    identity = {
        [NotiflyStorageKeys.PROJECT_ID]: projectId,
        [NotiflyStorageKeys.NOTIFLY_DEVICE_ID]: deviceId,
        [NotiflyStorageKeys.EXTERNAL_USER_ID]: 'user-a',
    };
    requests = [];
    configs = [];
    jest.spyOn(NotiflyStorage, 'getItems').mockImplementation(async (keys) => keys.map((key) => identity[key] ?? null));
    jest.spyOn(NotiflyStorage, 'getItem').mockImplementation(async (key) => identity[key] ?? null);
    jest.spyOn(NotiflyStorage, 'setItem').mockResolvedValue();
    log = jest.spyOn(EventLogger, 'logEvent').mockResolvedValue();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(tech.notifly.kmp.popup.PopupFactory, 'create').mockImplementation((config) => {
        configs.push(config);
        return {
            render(input, complete) {
                const cancel = jest.fn();
                requests.push({ input, complete, cancel });
                return { cancel };
            },
        };
    });
    SdkStateManager.state = SdkState.READY;
    SdkStateManager.setSdkVersion('2.21.0-alpha.1');
    UserStateManager.userData = {
        external_user_id: 'user-a',
        platform: 'web',
        sdk_version: '2.21.0-alpha.1',
        sdk_type: 'js',
    };
    UserStateManager.inWebMessageCampaigns = [];
    UserStateManager.eventIntermediateCounts = [];
});

afterEach(async () => {
    if (visibleFrame()) {
        loaded();
        await flush();
        window.dispatchEvent(
            new MessageEvent('message', { source: getIframe().contentWindow, data: { type: 'close' } })
        );
        await flush();
    }
    WebMessageScheduler.descheduleInWebMessage();
    dispose();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

test.each([undefined, 'static', 'future-mode', 'SSR'])(
    'keeps URL loading for mode %s without calling KMP',
    async (mode) => {
        const value = campaign();
        value.message.template_rendering_mode = mode;
        WebMessageScheduler.scheduleInWebMessage(value);
        await flush();
        expect(requests).toHaveLength(0);
        expect(visibleFrame()?.src).toBe(sourceUrl);
        expect(visibleFrame()?.hasAttribute('sandbox')).toBe(false);
    }
);

test('waits for KMP and forwards the trigger event and identity before showing isolated HTML', async () => {
    const value = campaign();
    UserStateManager.inWebMessageCampaigns = [value];
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
    WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts(
        'purchase',
        { coupon: 'WELCOME', items: ['one', 'two'], details: { total: 42 } },
        'user-a'
    );
    await flush();
    expect(visibleFrame()).toBeNull();
    expect(requests).toHaveLength(1);
    expect(configs[0]).toMatchObject({
        projectId,
        baseUrl: 'https://render.notifly.tech',
        sdkVersion: 'notifly/js/2.21.0-alpha.1',
    });
    expect(requests[0].input).toMatchObject({
        campaignId: 'campaign-1',
        deviceId,
        eventName: 'purchase',
        templateRenderingMode: 'ssr',
    });
    expect(requests[0].input.notiflyUserId).toMatch(/^[a-f0-9]{32}$/);
    expect(requests[0].input.eventParams?.asJsReadonlyMapView().get('coupon')).toBe('WELCOME');
    expect(log).not.toHaveBeenCalledWith(NotiflyInternalEvent.IN_WEB_MESSAGE_SHOW, expect.anything(), null, true);
    complete();
    await flush();
    expect(visibleFrame()?.srcdoc).toContain('Hello personalized user');
    expect(visibleFrame()?.getAttribute('sandbox')).toBe('allow-scripts');
    expect(visibleFrame()?.srcdoc).toContain(sourceUrl);
    loaded();
    await flush();
    expect(log).toHaveBeenCalledWith(
        NotiflyInternalEvent.IN_WEB_MESSAGE_SHOW,
        expect.objectContaining({ campaign_id: 'campaign-1' }),
        null,
        true
    );
});

test.each(['failed', 'skipped', 'cancelled'])(
    'does not fall back to the unrendered template for %s',
    async (outcome) => {
        WebMessageScheduler.scheduleInWebMessage(campaign());
        await flush();
        expect(requests).toHaveLength(1);
        complete(0, outcome);
        await flush();
        expect(visibleFrame()).toBeNull();
        expect(WebMessageScheduler.getScheduledCampaignIds()).toEqual([]);
    }
);

test('starts rendering only after the configured delay', async () => {
    WebMessageScheduler.scheduleInWebMessage(campaign('ssr', 5));
    await flush();
    expect(requests).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(4999);
    expect(requests).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(1);
    expect(requests).toHaveLength(1);
    expect(visibleFrame()).toBeNull();
});

test('cancels the KMP request and ignores its late completion', async () => {
    WebMessageScheduler.scheduleInWebMessage(campaign());
    await flush();
    expect(requests).toHaveLength(1);
    WebMessageScheduler.descheduleInWebMessage('campaign-1');
    expect(requests[0].cancel).toHaveBeenCalledTimes(1);
    complete();
    await flush();
    expect(visibleFrame()).toBeNull();
});

test('replacement keeps the new request even when the old request completes late', async () => {
    WebMessageScheduler.scheduleInWebMessage(campaign());
    await flush();
    expect(requests).toHaveLength(1);
    WebMessageScheduler.scheduleInWebMessage(campaign());
    await flush();
    expect(requests).toHaveLength(2);
    expect(requests[0].cancel).toHaveBeenCalledTimes(1);
    complete(0);
    await flush();
    expect(visibleFrame()).toBeNull();
    expect(WebMessageScheduler.getScheduledCampaignIds()).toEqual(['campaign-1']);
    complete(1);
    await flush();
    expect(visibleFrame()?.srcdoc).toContain('Hello personalized user');
});

test('does not render for a user who changed during the delay', async () => {
    WebMessageScheduler.scheduleInWebMessage(campaign('ssr', 5));
    identity[NotiflyStorageKeys.EXTERNAL_USER_ID] = 'user-b';
    await jest.advanceTimersByTimeAsync(5000);
    expect(requests).toHaveLength(0);
    expect(visibleFrame()).toBeNull();
});

test('discards HTML if the stored identity changed while rendering', async () => {
    WebMessageScheduler.scheduleInWebMessage(campaign());
    await flush();
    expect(requests).toHaveLength(1);
    identity[NotiflyStorageKeys.EXTERNAL_USER_ID] = 'user-b';
    complete();
    await flush();
    expect(visibleFrame()).toBeNull();
});

test('refreshing cancels in-flight rendering through the existing observer', async () => {
    WebMessageScheduler.initialize();
    WebMessageScheduler.scheduleInWebMessage(campaign());
    await flush();
    expect(requests).toHaveLength(1);
    SdkStateManager.state = SdkState.REFRESHING;
    expect(requests[0].cancel).toHaveBeenCalledTimes(1);
    complete();
    await flush();
    expect(visibleFrame()).toBeNull();
});

test('reserves the display slot so a later static popup cannot overtake SSR', async () => {
    WebMessageScheduler.scheduleInWebMessage(campaign());
    await flush();
    expect(requests).toHaveLength(1);
    WebMessageScheduler.scheduleInWebMessage({ ...campaign('static'), id: 'campaign-2' });
    expect(visibleFrame()).toBeNull();
    complete();
    await flush();
    expect(visibleFrame()?.srcdoc).toContain('Hello personalized user');
});

test('cancels a popup that is waiting for its iframe readiness message', async () => {
    WebMessageScheduler.scheduleInWebMessage(campaign());
    await flush();
    complete();
    await flush();
    expect(visibleFrame()).not.toBeNull();
    WebMessageScheduler.descheduleInWebMessage('campaign-1');
    loaded();
    await flush();
    expect(visibleFrame()).toBeNull();
    expect(log).not.toHaveBeenCalledWith(NotiflyInternalEvent.IN_WEB_MESSAGE_SHOW, expect.anything(), null, true);
    WebMessageScheduler.scheduleInWebMessage(campaign('static'));
    expect(visibleFrame()?.src).toBe(sourceUrl);
});

test('does not update campaign eligibility when rendering fails', async () => {
    const update = jest.spyOn(UserStateManager, 'updateAndGetCampaignHiddenUntilDataAccordingToReEligibleCondition');
    WebMessageScheduler.scheduleInWebMessage({ ...campaign(), re_eligible_condition: { unit: 'd', value: 1 } });
    await flush();
    complete(0, 'failed');
    await flush();
    expect(update).not.toHaveBeenCalled();
});

test('cancellation events also cancel campaigns whose KMP request has started', async () => {
    const value: Campaign = {
        ...campaign(),
        cancellation_conditions: [[{ type: 'event_name', operator: '=', operand: 'cancel_purchase' }]],
    };
    UserStateManager.inWebMessageCampaigns = [value];
    WebMessageScheduler.scheduleInWebMessage(value);
    await flush();
    WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('cancel_purchase', {}, 'user-a');
    expect(requests[0].cancel).toHaveBeenCalledTimes(1);
    complete();
    await flush();
    expect(visibleFrame()).toBeNull();
});

test('missing project identity skips the popup instead of loading the raw template', async () => {
    identity[NotiflyStorageKeys.PROJECT_ID] = null;
    WebMessageScheduler.scheduleInWebMessage(campaign());
    await flush();
    expect(requests).toHaveLength(0);
    expect(visibleFrame()).toBeNull();
    expect(WebMessageScheduler.getScheduledCampaignIds()).toEqual([]);
});

test('keeps the initial session-start popup while SDK initialization has not reached READY', async () => {
    SdkStateManager.state = SdkState.NOT_INITIALIZED;
    const value: Campaign = {
        ...campaign(),
        triggering_conditions: [[{ type: 'event_name', operator: '=', operand: 'notifly__session_start' }]],
    };
    UserStateManager.inWebMessageCampaigns = [value];
    WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts('notifly__session_start', {}, 'user-a');
    await flush();
    expect(requests).toHaveLength(1);
    SdkStateManager.state = SdkState.READY;
    complete();
    await flush();
    expect(visibleFrame()?.srcdoc).toContain('Hello personalized user');
});
