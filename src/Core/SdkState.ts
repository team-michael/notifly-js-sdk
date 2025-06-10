import { SDK_VERSION } from '../Version';

export enum SdkState {
    NOT_INITIALIZED = 0, // SDK is not initialized
    READY = 1, // SDK is initialized and ready to use
    REFRESHING = 2, // SDK is changing user ID
    FAILED = 3, // SDK failed
    TERMINATED = 4, // SDK is terminated
}

export enum SdkType {
    JS = 'js',
    JS_CAFE24 = 'js-cafe24',
    JS_FLUTTER = 'js-flutter',
}

export interface SdkStateObserver {
    onInitialized?: () => void;
    onRefreshStarted?: () => void;
    onRefreshCompleted?: () => void;
    onTerminated?: () => void;
}

export class SdkStateManager {
    private static _state: SdkState = SdkState.NOT_INITIALIZED;
    private static _observers: SdkStateObserver[] = [];
    static type: SdkType = SdkType.JS;
    static version: string = SDK_VERSION;
    static source: 'cafe24' | null = null;
    private static _allowUserSuppliedLogEvent = false;

    static registerObserver(observer: SdkStateObserver): void {
        this._observers.push(observer);
    }

    static get state(): SdkState {
        return this._state;
    }

    static set state(state: SdkState) {
        if (this._state === state) {
            return;
        }

        const previousState = this._state;
        this._state = state;

        if (state === SdkState.TERMINATED) {
            this._observers.forEach((observer) => observer.onTerminated?.());
            return;
        }

        switch ([previousState, state].join(',')) {
            case [SdkState.NOT_INITIALIZED, SdkState.READY].join(','):
                this._observers.forEach((observer) => observer.onInitialized?.());
                break;
            case [SdkState.READY, SdkState.REFRESHING].join(','):
                this._observers.forEach((observer) => observer.onRefreshStarted?.());
                break;
            case [SdkState.REFRESHING, SdkState.READY].join(','):
                this._observers.forEach((observer) => observer.onRefreshCompleted?.());
                break;
            default:
                break;
        }
    }

    static get halted(): boolean {
        return this._state === SdkState.FAILED || this._state === SdkState.TERMINATED;
    }

    static setSdkType(type: SdkType): void {
        this.type = type;
    }

    static setSdkVersion(version: string): void {
        this.version = version;
    }

    static getSdkVersion(): string {
        return this.version;
    }

    static setSource(source: 'cafe24' | null): void {
        this.source = source;
    }

    static get allowUserSuppliedLogEvent(): boolean {
        return this._allowUserSuppliedLogEvent;
    }

    static setAllowUserSuppliedLogEvent(value: boolean | undefined): void {
        this._allowUserSuppliedLogEvent = value ?? false;
    }
}
