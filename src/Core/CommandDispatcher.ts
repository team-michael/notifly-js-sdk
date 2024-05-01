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

    private _isFlushing = false;

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
        if (this._isFlushing) {
            return this._getEnqueuePromise(command);
        }

        switch (SdkStateManager.state) {
            case SdkState.TERMINATED:
                throw new Error('[Notifly] Notifly SDK is terminated. Ingnoring command.');
            case SdkState.FAILED:
                throw new Error(`[Notifly] Notifly SDK has failed to operate. Cannot execute command ${command.type}`);
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            case SdkState.NOT_INITIALIZED:
                // Fallthrough
                console.info(
                    '[Notifly] Notifly SDK is not initialized. Requested command will be executed as soon as the SDK is initialized.'
                );
            // eslint-disable-next-line no-fallthrough
            case SdkState.REFRESHING:
                return this._getEnqueuePromise(command);
            case SdkState.READY: {
                const doesCommandNeedRefresh = command.type === CommandType.SET_USER_ID;
                if (doesCommandNeedRefresh) {
                    SdkStateManager.state = SdkState.REFRESHING;
                }
                try {
                    const result = await command.execute();
                    if (doesCommandNeedRefresh) {
                        SdkStateManager.state = SdkState.READY;
                    }
                    return result;
                } catch (error) {
                    SdkStateManager.state = SdkState.FAILED;
                    throw error;
                }
            }
        }
    }

    // This funcion can only be called when the SDK state is changed to READY
    private async _flush() {
        this._isFlushing = true;

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
                    this._isFlushing = false;
                    return;
                }

                if (commandWrapper.command.type === CommandType.SET_USER_ID) {
                    SdkStateManager.state = SdkState.READY; // Setting state as READY will fire onRefreshCompleted
                    // We do not set _isFlushing to false here because onRefreshCompleted will be called
                    return; // Should return here to avoid duplicated flush
                }
            }
        }

        if (!this._commandQueue.isEmpty()) {
            await this._flush();
        }

        this._isFlushing = false;
    }

    private async _getEnqueuePromise<T>(command: CommandBase<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this._commandQueue.enqueue(new CommandWrapper<T>(command, resolve, reject, this._currentPriority++));
        });
    }
}
