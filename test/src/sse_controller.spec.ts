import { SSEClient } from '../../src/Core/SSE/SSEClient';
import { SSEController } from '../../src/Core/SSE/SSEController';

class FakeSSEClient {
    connectCalls = 0;
    disconnectCalls = 0;
    onMessage: ((type: string, data: string) => void) | null = null;
    onState: ((state: { kind: string; attempt?: number }) => void) | null = null;
    connect(): void {
        this.connectCalls += 1;
    }
    disconnect(): void {
        this.disconnectCalls += 1;
    }
}

function makeController(opts: {
    onSyncRequested?: (completion: () => void) => void;
    onServerEventTriggered?: (name: string, params: Record<string, unknown> | null) => void;
    scheduler?: (delayMs: number, work: () => void) => void;
    fallbackAfterAttempts?: number;
} = {}): { controller: SSEController; client: FakeSSEClient } {
    const client = new FakeSSEClient();
    const controller = new SSEController({
        sseClient: client as unknown as SSEClient,
        onSyncRequested: opts.onSyncRequested ?? ((c) => c()),
        onServerEventTriggered: opts.onServerEventTriggered ?? (() => undefined),
        scheduler: opts.scheduler ?? ((_d, w) => w()),
        fallbackAfterAttempts: opts.fallbackAfterAttempts ?? 3,
    });
    return { controller, client };
}

describe('SSEController', () => {
    test('connectedMessage_setsModeToSse', () => {
        const { controller } = makeController();
        controller.handleMessage('connected', '{}');
        expect(controller.mode).toBe('sse');
    });

    test('syncMessage_triggersOnSyncRequested', () => {
        let called = 0;
        const { controller } = makeController({
            onSyncRequested: (c) => {
                called += 1;
                c();
            },
        });
        controller.handleMessage('sync', '{}');
        expect(called).toBe(1);
    });

    test('syncMessage_doesNotDispatch_whileInFlight', () => {
        let called = 0;
        const { controller } = makeController({
            onSyncRequested: () => {
                called += 1;
            },
        });
        controller.handleMessage('sync', '{}');
        controller.handleMessage('sync', '{}');
        controller.handleMessage('sync', '{}');
        expect(called).toBe(1);
    });

    test('syncMessage_doesNotDispatch_whilePendingDebounce', () => {
        let called = 0;
        const { controller } = makeController({
            onSyncRequested: (c) => {
                called += 1;
                c();
            },
            scheduler: () => undefined,
        });
        controller.handleMessage('sync', '{}');
        controller.handleMessage('sync', '{}');
        expect(called).toBe(1);
    });

    test('syncMessage_redispatchedAfterDebounceEnds', () => {
        let called = 0;
        let pendingWork: (() => void) | null = null;
        const { controller } = makeController({
            onSyncRequested: (c) => {
                called += 1;
                c();
            },
            scheduler: (_d, w) => {
                pendingWork = w;
            },
        });
        controller.handleMessage('sync', '{}');
        pendingWork?.();
        controller.handleMessage('sync', '{}');
        expect(called).toBe(2);
    });

    test('serverEvent_routesNameAndParams', () => {
        let name: string | null = null;
        let params: Record<string, unknown> | null = null;
        const { controller } = makeController({
            onServerEventTriggered: (n, p) => {
                name = n;
                params = p;
            },
        });
        controller.handleMessage(
            'server-event',
            '{"name":"order_completed","eventParams":{"x":1}}',
        );
        expect(name).toBe('order_completed');
        expect(params).toEqual({ x: 1 });
    });

    test('ttlExpired_triggersReconnect', () => {
        const { controller, client } = makeController();
        controller.handleMessage('ttl-expired', '{}');
        expect(client.disconnectCalls).toBe(1);
        expect(client.connectCalls).toBe(1);
    });

    test('shutdown_disconnectsAndSchedulesReconnect', () => {
        let capturedDelay = -1;
        let capturedWork: (() => void) | null = null;
        const { controller, client } = makeController({
            scheduler: (d, w) => {
                capturedDelay = d;
                capturedWork = w;
            },
        });
        controller.handleMessage('shutdown', '{"reconnectInMs":1500}');
        expect(client.disconnectCalls).toBe(1);
        expect(capturedDelay).toBe(1500);
        capturedWork?.();
        expect(client.connectCalls).toBe(1);
    });

    test('shutdown_scheduledReconnect_dropsIfStopCalledBefore', () => {
        let capturedWork: (() => void) | null = null;
        const { controller, client } = makeController({
            scheduler: (_d, w) => {
                capturedWork = w;
            },
        });
        controller.handleMessage('shutdown', '{"reconnectInMs":100}');
        controller.stop();
        capturedWork?.();
        expect(client.connectCalls).toBe(0);
    });

    test('reconnecting_attempt3_withoutEverReachingOpen_entersFallback', () => {
        const { controller, client } = makeController();
        controller.handleStateChange({ kind: 'reconnecting', attempt: 3 });
        expect(controller.mode).toBe('fallback');
        expect(client.disconnectCalls).toBe(1);
    });

    test('reconnecting_below3_doesNotEnterFallback', () => {
        const { controller } = makeController();
        controller.handleStateChange({ kind: 'reconnecting', attempt: 2 });
        expect(controller.mode).toBe('sse');
    });

    test('reconnecting_afterReachedOpen_doesNotEnterFallback', () => {
        const { controller } = makeController();
        controller.handleStateChange({ kind: 'open' });
        controller.handleStateChange({ kind: 'reconnecting', attempt: 5 });
        expect(controller.mode).toBe('sse');
    });

    test('open_setsModeToSseAndHasReachedOpen', () => {
        const { controller } = makeController();
        controller.handleStateChange({ kind: 'open' });
        expect(controller.mode).toBe('sse');
    });
});
