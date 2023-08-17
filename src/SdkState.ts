export enum SdkState {
    NOT_INITIALIZED = 0, // SDK is not initialized
    READY = 1, // SDK is initialized and ready to use
    REFRESHING = 2, // SDK is changing user ID
    FAILED = 3, // SDK failed
}

export interface SdkStateObserver {
    onInitialized(): void;
    onRefreshCompleted(): void;
}

export class SdkStateManager {
    private static _state: SdkState = SdkState.NOT_INITIALIZED;
    private static _observers: SdkStateObserver[] = [];

    static registerObserver(observer: SdkStateObserver): void {
        this._observers.push(observer);
    }

    static set state(state: SdkState) {
        const previousState = this._state;
        this._state = state;

        switch ([previousState, state].join(',')) {
            case [SdkState.NOT_INITIALIZED, SdkState.READY].join(','):
                this._observers.forEach((observer) => observer.onInitialized());
                break;
            case [SdkState.REFRESHING, SdkState.READY].join(','):
                this._observers.forEach((observer) => observer.onRefreshCompleted());
                break;
            default:
                break;
        }
    }

    static isReady(): boolean {
        return this._state === SdkState.READY;
    }

    static isRefreshing(): boolean {
        return this._state === SdkState.REFRESHING;
    }

    static isNotInitialized(): boolean {
        return this._state === SdkState.NOT_INITIALIZED;
    }

    static isFailed(): boolean {
        return this._state === SdkState.FAILED;
    }
}
