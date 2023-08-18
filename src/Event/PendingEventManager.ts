import { SdkStateManager, SdkStateObserver } from '../SdkState';

type ResolvingSdkEventName = 'initialized' | 'refresh_completed';

type PendingEventUnit = {
    eventName: string; // For debugging purposes
    resolvedWhen: ResolvingSdkEventName;
    resolver: (value: void | PromiseLike<void>) => void;
};
export class PendingEventManager implements SdkStateObserver {
    private _queue: PendingEventUnit[];

    constructor() {
        this._queue = [];
        SdkStateManager.registerObserver(this);
    }

    dispatchEventAndWaitForSdkEvent(eventName: string, resolvedWhen: ResolvingSdkEventName): Promise<void> {
        return new Promise((resolve) => {
            this._queue.push({
                eventName,
                resolvedWhen,
                resolver: resolve,
            });
        });
    }

    private _resolve(sdkEvent: ResolvingSdkEventName) {
        const eventsToProcess = this._queue.filter((event) => event.resolvedWhen === sdkEvent);
        const eventsToKeep = this._queue.filter((event) => event.resolvedWhen !== sdkEvent);
        this._queue = eventsToKeep;

        for (const event of eventsToProcess) {
            event.resolver();
        }
    }

    onInitialized(): void {
        this._resolve('initialized');
    }

    onRefreshCompleted(): void {
        this._resolve('refresh_completed');
    }

    onRefreshStarted(): void {
        // No-op
        return;
    }
}
