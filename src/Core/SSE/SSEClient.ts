import { SSELineParser } from './SSELineParser';
import { FetchStreamLineProvider, StreamLineProvider } from './StreamLineProvider';

export type SSEState =
    | { kind: 'idle' }
    | { kind: 'connecting' }
    | { kind: 'open' }
    | { kind: 'reconnecting'; attempt: number }
    | { kind: 'stopped' };

export type SSEStateListener = (state: SSEState) => void;
export type SSEMessageListener = (type: string, data: string) => void;

export interface SSEClientOptions {
    projectId: string;
    notiflyUserId: string;
    deviceId: string | null;
    baseUrl: string;
    tokenProvider: () => Promise<string>;
    sdkVersionHeader: string;
    backoffScheduleMs?: number[];
    heartbeatTimeoutMs?: number;
    openStableThresholdMs?: number;
    provider?: StreamLineProvider;
    jitterProvider?: () => number;
    nowProvider?: () => number;
}

const DEFAULT_BACKOFF_SCHEDULE_MS = [10000];
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 60000;
const DEFAULT_OPEN_STABLE_THRESHOLD_MS = 30000;
const WATCHDOG_RESOLUTION_DIVISOR = 4;
const WATCHDOG_MAX_INTERVAL_MS = 5000;
const WATCHDOG_MIN_INTERVAL_MS = 50;
const HTTP_OK = 200;

function defaultJitter(): number {
    return Math.random();
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = (): void => {
            clearTimeout(timer);
            reject(new DOMException('aborted', 'AbortError'));
        };
        if (signal.aborted) {
            onAbort();
            return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
    });
}

function isAbortError(e: unknown): boolean {
    return e instanceof DOMException && (e.name === 'AbortError' || e.name === 'TimeoutError');
}

export class SSEClient {
    private readonly opts: Required<
        Omit<SSEClientOptions, 'provider' | 'jitterProvider' | 'nowProvider' | 'deviceId'>
    > & {
        deviceId: string | null;
        provider: StreamLineProvider;
        jitterProvider: () => number;
        nowProvider: () => number;
    };

    private state: SSEState = { kind: 'idle' };
    private lastEventIdInternal: string | null = null;
    private lastDataAt: number;
    private lastOpenAt: number | null = null;
    private runAbortController: AbortController | null = null;

    onState: SSEStateListener | null = null;
    onMessage: SSEMessageListener | null = null;

    constructor(opts: SSEClientOptions) {
        this.opts = {
            projectId: opts.projectId,
            notiflyUserId: opts.notiflyUserId,
            deviceId: opts.deviceId,
            baseUrl: opts.baseUrl,
            tokenProvider: opts.tokenProvider,
            sdkVersionHeader: opts.sdkVersionHeader,
            backoffScheduleMs: opts.backoffScheduleMs ?? DEFAULT_BACKOFF_SCHEDULE_MS,
            heartbeatTimeoutMs: opts.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS,
            openStableThresholdMs: opts.openStableThresholdMs ?? DEFAULT_OPEN_STABLE_THRESHOLD_MS,
            provider: opts.provider ?? new FetchStreamLineProvider(),
            jitterProvider: opts.jitterProvider ?? defaultJitter,
            nowProvider: opts.nowProvider ?? (() => Date.now()),
        };
        this.lastDataAt = this.opts.nowProvider();
    }

    getState(): SSEState {
        return this.state;
    }

    getLastEventId(): string | null {
        return this.lastEventIdInternal;
    }

    connect(): void {
        if (this.state.kind === 'connecting' || this.state.kind === 'open' || this.state.kind === 'reconnecting') {
            return;
        }
        this.runAbortController?.abort();
        this.runAbortController = new AbortController();
        const next: SSEState = { kind: 'connecting' };
        this.state = next;
        this.lastOpenAt = null;
        this.emitState(next);
        void this.runConnectionLoop(this.runAbortController.signal);
    }

    disconnect(): void {
        const previous = this.runAbortController;
        this.runAbortController = null;
        this.lastOpenAt = null;
        const wasStopped = this.state.kind === 'stopped';
        this.state = { kind: 'stopped' };
        try {
            previous?.abort();
        } catch (e) {
            void e;
        }
        if (!wasStopped) {
            console.info('[Notifly][sse] disconnected');
            this.emitState(this.state);
        }
    }

    private isStopped(): boolean {
        return this.state.kind === 'stopped';
    }

    private async runConnectionLoop(signal: AbortSignal): Promise<void> {
        let attempt = 0;
        while (!this.isStopped() && !signal.aborted) {
            try {
                await this.runOneConnection(attempt, signal);
            } catch (e) {
                if (isAbortError(e)) break;
                console.warn(`[Notifly][sse] connection error: ${(e as Error)?.message ?? e}`);
            }
            if (this.isStopped() || signal.aborted) break;

            const openedAt = this.lastOpenAt;
            if (openedAt !== null && this.opts.nowProvider() - openedAt >= this.opts.openStableThresholdMs) {
                attempt = 0;
            }
            attempt += 1;
            this.transition({ kind: 'reconnecting', attempt });
            try {
                await sleep(this.backoffDelayMs(attempt), signal);
            } catch (e) {
                void e;
                break;
            }
        }
    }

    private async runOneConnection(attempt: number, signal: AbortSignal): Promise<void> {
        if (attempt > 0) this.transition({ kind: 'connecting' });
        this.lastDataAt = this.opts.nowProvider();

        const token = await this.opts.tokenProvider();
        const url = this.buildUrl();
        const headers = this.buildHeaders(token, this.lastEventIdInternal);
        const response = await this.opts.provider.open(url, headers, signal);

        if (response.statusCode !== HTTP_OK) {
            console.error(
                `[Notifly][sse] handshake failed: status=${response.statusCode} projectId=${this.opts.projectId}`
            );
            try {
                response.close();
            } catch (e) {
                void e;
            }
            throw new Error(`SSE http status ${response.statusCode}`);
        }
        const ct = (response.contentType ?? '').toLowerCase();
        if (!ct.startsWith('text/event-stream')) {
            console.error(`[Notifly][sse] invalid content-type: ${ct} projectId=${this.opts.projectId}`);
            try {
                response.close();
            } catch (e) {
                void e;
            }
            throw new Error('SSE invalid response');
        }

        this.transition({ kind: 'open' });
        console.info('[Notifly][sse] connected');
        this.lastDataAt = this.opts.nowProvider();

        const consume = this.consumeStream(response.lines, signal);
        const watchdog = this.runHeartbeatWatchdog(signal);
        try {
            await Promise.race([consume, watchdog]);
        } finally {
            try {
                response.close();
            } catch (e) {
                void e;
            }
        }
    }

    private async consumeStream(lines: AsyncIterable<string>, signal: AbortSignal): Promise<void> {
        const parser = new SSELineParser();
        for await (const line of lines) {
            if (signal.aborted) return;
            this.lastDataAt = this.opts.nowProvider();
            const event = parser.feed(line);
            if (!event) continue;
            if (event.id !== null) this.lastEventIdInternal = event.id;
            this.emitMessage(event.type, event.data);
        }
    }

    private async runHeartbeatWatchdog(signal: AbortSignal): Promise<void> {
        const checkInterval = Math.max(
            Math.min(Math.floor(this.opts.heartbeatTimeoutMs / WATCHDOG_RESOLUTION_DIVISOR), WATCHDOG_MAX_INTERVAL_MS),
            WATCHDOG_MIN_INTERVAL_MS
        );
        while (!signal.aborted) {
            await sleep(checkInterval, signal);
            const elapsed = this.opts.nowProvider() - this.lastDataAt;
            if (elapsed > this.opts.heartbeatTimeoutMs) {
                throw new Error(`SSE heartbeat timeout (${elapsed}ms)`);
            }
        }
    }

    private transition(next: SSEState): void {
        if (this.state.kind === 'stopped') return;
        const changed =
            this.state.kind !== next.kind ||
            (this.state.kind === 'reconnecting' && next.kind === 'reconnecting' && this.state.attempt !== next.attempt);
        this.state = next;
        this.lastOpenAt = next.kind === 'open' ? this.opts.nowProvider() : null;
        if (changed) this.emitState(next);
    }

    private emitState(s: SSEState): void {
        const cb = this.onState;
        if (!cb) return;
        try {
            cb(s);
        } catch (e) {
            void e;
        }
    }

    private emitMessage(type: string, data: string): void {
        const cb = this.onMessage;
        if (!cb) return;
        try {
            cb(type, data);
        } catch (e) {
            void e;
        }
    }

    private backoffDelayMs(attempt: number): number {
        const schedule = this.opts.backoffScheduleMs;
        const idx = Math.min(Math.max(attempt - 1, 0), schedule.length - 1);
        const base = schedule[idx];
        const jitter = this.opts.jitterProvider();
        return Math.max(100, Math.floor(base * jitter));
    }

    private buildUrl(): string {
        const base = this.opts.baseUrl.replace(/\/+$/, '');
        const path = `/projects/${encodeURIComponent(this.opts.projectId)}/users/${encodeURIComponent(
            this.opts.notiflyUserId
        )}/streams`;
        const query =
            this.opts.deviceId && this.opts.deviceId.length > 0
                ? `?deviceId=${encodeURIComponent(this.opts.deviceId)}`
                : '';
        return `${base}${path}${query}`;
    }

    private buildHeaders(token: string, lastEventId: string | null): Record<string, string> {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${token}`,
            'x-notifly-sdk-version': this.opts.sdkVersionHeader,
            Accept: 'text/event-stream',
        };
        if (lastEventId && lastEventId.length > 0) {
            headers['Last-Event-ID'] = lastEventId;
        }
        return headers;
    }
}
