/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommandBase, CommandType } from './Interfaces/Command';
import { IComparable } from './Interfaces/Comparable';

import { SdkState, SdkStateManager, SdkStateObserver } from './SdkState';
import PriorityQueue from './Utils/PriorityQueue';

class CommandWrapper<T> implements IComparable<CommandWrapper<unknown>> {
    constructor(
        public command: CommandBase<T>,
        public resolver: (value: T | PromiseLike<T>) => void,
        public rejecter: (reason?: any) => void,
        private _priority: number
    ) {}

    compareTo(other: CommandWrapper<unknown>): number {
        return this._priority - other._priority;
    }
}

export class CommandDispatcher implements SdkStateObserver {
    private _commandQueue = new PriorityQueue<CommandWrapper<any>>();
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

    async dispatch<T>(command: CommandBase<T>): Promise<T> {
        switch (SdkStateManager.state) {
            case SdkState.FAILED:
                throw new Error(`[Notifly] Notifly SDK has failed to operate. Cannot execute command ${command.type}`);
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            case SdkState.NOT_INITIALIZED:
                // Fallthrough
                console.info(
                    '[Notifly] Notifly SDK is not initialized. This command will be executed as soon as the SDK is initialized.'
                );
            // eslint-disable-next-line no-fallthrough
            case SdkState.REFRESHING:
                return new Promise<T>((resolve, reject) => {
                    this._commandQueue.enqueue(
                        new CommandWrapper<T>(command, resolve, reject, this._currentPriority++)
                    );
                });
            case SdkState.READY: {
                if (command.type === CommandType.SET_USER_ID) {
                    SdkStateManager.state = SdkState.REFRESHING;
                }
                const result = await command.execute();
                if (command.type === CommandType.SET_USER_ID) {
                    SdkStateManager.state = SdkState.READY;
                }

                return result;
            }
        }
    }

    // This funcion can only be called when the SDK state is changed to READY
    private async _flush() {
        while (!this._commandQueue.isEmpty()) {
            if (SdkStateManager.state !== SdkState.READY) {
                console.error(`[Notifly] Unexpected SDK state ${SdkStateManager.state}. Cannot flush command queue.`);
                return;
            }

            const commandWrapper = this._commandQueue.dequeue();
            if (commandWrapper) {
                if (commandWrapper.command.type === CommandType.SET_USER_ID) {
                    SdkStateManager.state = SdkState.REFRESHING;
                }

                try {
                    const result = await commandWrapper.command.execute();
                    commandWrapper.resolver(result);
                } catch (error) {
                    commandWrapper.rejecter(error);
                    SdkStateManager.state = SdkState.FAILED;
                    return;
                }

                if (commandWrapper.command.type === CommandType.SET_USER_ID) {
                    SdkStateManager.state = SdkState.READY;
                    return; // Should return here to avoid duplicated flush
                }
            }
        }
    }
}
