import { CommandBase, CommandType } from './Interfaces/Command';
import { IComparable } from './Interfaces/Comparable';

import { SdkState, SdkStateManager, SdkStateObserver } from './SdkState';
import PriorityQueue from './Utils/PriorityQueue';

class CommandWrapper implements IComparable<CommandWrapper> {
    constructor(
        public command: CommandBase,
        public resolver: (value?: void | PromiseLike<void>) => void,
        private _priority: number
    ) {}

    compareTo(other: CommandWrapper): number {
        return this._priority - other._priority;
    }
}

export class CommandDispatcher implements SdkStateObserver {
    private _commandQueue = new PriorityQueue<CommandWrapper>();
    private _currentPriority = 0;
    private static _instance: CommandDispatcher | null;

    constructor() {
        SdkStateManager.registerObserver(this);
    }

    static getInstance(): CommandDispatcher {
        if (!CommandDispatcher._instance) {
            CommandDispatcher._instance = new CommandDispatcher();
        }
        return CommandDispatcher._instance;
    }

    onInitialized(): void {
        this._flush();
    }

    onRefreshStarted(): void {
        // Nothing to do here
    }

    onRefreshCompleted(): void {
        this._flush();
    }

    async dispatch(command: CommandBase): Promise<void> {
        switch (SdkStateManager.state) {
            case SdkState.FAILED:
                console.error(`[Notifly] Notifly SDK has failed to operate. Cannot execute command ${command.type}`);
                return;
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            case SdkState.NOT_INITIALIZED:
                // Fallthrough
                console.info(
                    '[Notifly] Notifly SDK is not initialized. This command will be executed as soon as the SDK is initialized.'
                );
            // eslint-disable-next-line no-fallthrough
            case SdkState.REFRESHING:
                return new Promise<void>((resolve) => {
                    this._commandQueue.enqueue(new CommandWrapper(command, resolve, this._currentPriority++));
                });
            case SdkState.READY:
                return command.execute();
        }
    }

    private async _flush() {
        while (!this._commandQueue.isEmpty()) {
            const commandWrapper = this._commandQueue.dequeue();
            if (commandWrapper) {
                await commandWrapper.command.execute();
                commandWrapper.resolver();
                if (commandWrapper.command.type === CommandType.SET_USER_ID) {
                    break;
                }
            }
        }
    }
}
