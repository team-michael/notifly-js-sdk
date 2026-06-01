import { SSEClient, SSEState } from './SSEClient';
import { decodeSSEMessage } from './SSEMessage';

export type SSEMode = 'sse' | 'fallback';
export type Scheduler = (delayMs: number, work: () => void) => void;
export type SyncRequestedCallback = (completion: () => void) => void;
export type ServerEventCallback = (name: string, eventParams: Record<string, unknown> | null) => void;

export interface SSEControllerOptions {
    sseClient: SSEClient;
    onSyncRequested: SyncRequestedCallback;
    onServerEventTriggered: ServerEventCallback;
    syncDebounceMs?: number;
    fallbackAfterAttempts?: number;
    scheduler?: Scheduler;
}

const DEFAULT_SYNC_DEBOUNCE_MS = 500;
const DEFAULT_FALLBACK_AFTER_ATTEMPTS = 3;

function defaultScheduler(delayMs: number, work: () => void): void {
    setTimeout(work, delayMs);
}

export class SSEController {
    private readonly sseClient: SSEClient;
    private readonly onSyncRequested: SyncRequestedCallback;
    private readonly onServerEventTriggered: ServerEventCallback;
    private readonly syncDebounceMs: number;
    private readonly fallbackAfterAttempts: number;
    private readonly scheduler: Scheduler;

    private hasReachedOpen = false;
    private modeInternal: SSEMode = 'sse';
    private syncInFlight = false;
    private pendingSyncDispatch = false;
    private generation = 0;

    constructor(opts: SSEControllerOptions) {
        this.sseClient = opts.sseClient;
        this.onSyncRequested = opts.onSyncRequested;
        this.onServerEventTriggered = opts.onServerEventTriggered;
        this.syncDebounceMs = opts.syncDebounceMs ?? DEFAULT_SYNC_DEBOUNCE_MS;
        this.fallbackAfterAttempts = opts.fallbackAfterAttempts ?? DEFAULT_FALLBACK_AFTER_ATTEMPTS;
        this.scheduler = opts.scheduler ?? defaultScheduler;

        this.sseClient.onMessage = (type, data) => this.handleMessage(type, data);
        this.sseClient.onState = (state) => this.handleStateChange(state);
    }

    get mode(): SSEMode {
        return this.modeInternal;
    }

    start(): void {
        this.sseClient.connect();
    }

    stop(): void {
        this.generation += 1;
        this.sseClient.disconnect();
    }

    reconnect(): void {
        this.sseClient.disconnect();
        this.sseClient.connect();
    }

    handleMessage(type: string, data: string): void {
        const message = decodeSSEMessage(type, data);
        switch (message.kind) {
            case 'connected':
                this.hasReachedOpen = true;
                this.modeInternal = 'sse';
                break;
            case 'sync':
                console.info('[Notifly][sse] sync received');
                this.triggerSyncDebounced();
                break;
            case 'event':
                this.onServerEventTriggered(message.name, message.eventParams);
                break;
            case 'shutdown':
                this.handleShutdown(message.reconnectInMs);
                break;
            case 'ttl-expired':
                this.reconnect();
                break;
            case 'unknown':
            case 'malformed':
                break;
        }
    }

    handleStateChange(state: SSEState): void {
        if (state.kind === 'open') {
            this.hasReachedOpen = true;
            this.modeInternal = 'sse';
            return;
        }
        if (state.kind === 'reconnecting') {
            if (
                !this.hasReachedOpen &&
                state.attempt >= this.fallbackAfterAttempts &&
                this.modeInternal !== 'fallback'
            ) {
                this.modeInternal = 'fallback';
                this.sseClient.disconnect();
            }
        }
    }

    private triggerSyncDebounced(): void {
        if (this.pendingSyncDispatch || this.syncInFlight) return;
        this.pendingSyncDispatch = true;
        this.syncInFlight = true;
        this.onSyncRequested(() => {
            this.syncInFlight = false;
        });
        this.scheduler(this.syncDebounceMs, () => {
            this.pendingSyncDispatch = false;
        });
    }

    private handleShutdown(reconnectInMs: number): void {
        this.sseClient.disconnect();
        const scheduledGen = this.generation;
        const delay = Math.max(reconnectInMs, 0);
        this.scheduler(delay, () => {
            if (this.generation === scheduledGen) this.sseClient.connect();
        });
    }
}
