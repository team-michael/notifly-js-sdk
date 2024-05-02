/* eslint-disable @typescript-eslint/no-explicit-any */
import { IComparable } from '../Interfaces/Comparable';

import { CommandBase, CommandType } from './Commands';
import { SdkState, SdkStateManager, SdkStateObserver } from '../SdkState';
import PriorityQueue from '../Utils/PriorityQueue';

class CommandWrapper<T> {
    constructor(
        public command: CommandBase<T>,
        public resolver: (value: T | PromiseLike<T>) => void,
        public rejecter: (reason?: any) => void
    ) {}

    abort() {
        this.rejecter('Command aborted.');
    }
}

class PendingCommandWrapper<T> extends CommandWrapper<T> implements IComparable<PendingCommandWrapper<unknown>> {
    private _priority: number;

    constructor(
        command: CommandBase<T>,
        resolver: (value: T | PromiseLike<T>) => void,
        rejecter: (reason?: any) => void,
        _priority: number
    ) {
        super(command, resolver, rejecter);
        this._priority = _priority;
    }

    compareTo(other: PendingCommandWrapper<unknown>): number {
        return this._priority - other._priority;
    }
}

export class CommandManager implements SdkStateObserver {
    private static _instance: CommandManager | null;

    private _activeCommands: CommandWrapper<any>[] = [];
    private _pendingCommandsQueue = new PriorityQueue<PendingCommandWrapper<any>>();
    private _currentPriority = 0;

    private _isFlushing = false;

    constructor() {
        SdkStateManager.registerObserver(this);
    }

    static getInstance(): CommandManager {
        if (!CommandManager._instance) {
            CommandManager._instance = new CommandManager();
        }
        return CommandManager._instance;
    }

    onInitialized(): void {
        this._flush();
    }

    onRefreshCompleted(): void {
        this._flush();
    }

    onTerminated() {
        this._abortAll();
    }

    async dispatch<T>(command: CommandBase<T>): Promise<T> {
        if (this._isFlushing) {
            return this._getPendingCommandPromise(command);
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
                return this._getPendingCommandPromise(command);
            case SdkState.READY:
                return this._getInstantCommandPromise(command);
        }
    }

    // This funcion can only be called when the SDK state is changed to READY
    private async _flush() {
        this._isFlushing = true;

        while (!this._pendingCommandsQueue.isEmpty()) {
            if (SdkStateManager.state !== SdkState.READY) {
                console.error(`[Notifly] Unexpected SDK state ${SdkStateManager.state}. Cannot flush command queue.`);
                this._isFlushing = false;
                return;
            }

            const commandWrapper = this._pendingCommandsQueue.dequeue();
            if (commandWrapper) {
                if (commandWrapper.command.type === CommandType.SET_USER_ID) {
                    SdkStateManager.state = SdkState.REFRESHING;
                }

                try {
                    const result = await commandWrapper.command.execute();
                    commandWrapper.resolver(result);
                } catch (error) {
                    if (this._handleCommandError(commandWrapper, error)) {
                        this._isFlushing = false;
                        return;
                    }
                    return;
                } finally {
                    this._removeCommand(commandWrapper);
                }

                if (commandWrapper.command.type === CommandType.SET_USER_ID) {
                    SdkStateManager.state = SdkState.READY; // Setting state as READY will fire onRefreshCompleted
                    // We do not set _isFlushing to false here because onRefreshCompleted will be called
                    return; // Should return here to avoid duplicated flush
                }
            }
        }

        if (!this._pendingCommandsQueue.isEmpty()) {
            await this._flush();
        }

        this._isFlushing = false;
    }

    private async _getInstantCommandPromise<T>(command: CommandBase<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const commandWrapper = new CommandWrapper<T>(command, resolve, reject);
            this._activeCommands.push(commandWrapper);

            const doesCommandNeedRefresh = command.type === CommandType.SET_USER_ID;
            if (doesCommandNeedRefresh) {
                SdkStateManager.state = SdkState.REFRESHING;
            }
            command
                .execute()
                .then((value) => {
                    if (doesCommandNeedRefresh) {
                        SdkStateManager.state = SdkState.READY;
                    }
                    resolve(value);
                })
                .catch((error) => {
                    this._handleCommandError(commandWrapper, error);
                })
                .finally(() => {
                    this._removeCommand(commandWrapper);
                });
        });
    }

    private async _getPendingCommandPromise<T>(command: CommandBase<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const commandWrapper = new PendingCommandWrapper<T>(command, resolve, reject, this._currentPriority++);
            this._activeCommands.push(commandWrapper);
            this._pendingCommandsQueue.enqueue(commandWrapper);
        });
    }

    private async _removeCommand(command: CommandWrapper<any>) {
        const index = this._activeCommands.indexOf(command);
        if (index !== -1) {
            this._activeCommands.splice(index, 1);
        }
    }

    private async _abortAll() {
        for (const command of this._activeCommands) {
            command.abort();
        }
        this._activeCommands = [];
        this._pendingCommandsQueue.clear();
    }

    private _handleCommandError(commandWrapper: CommandWrapper<any>, error: any): boolean {
        if (SdkStateManager.state === SdkState.TERMINATED) {
            return true;
        }
        if (commandWrapper.command.unrecoverable) {
            SdkStateManager.state = SdkState.FAILED;
        }
        commandWrapper.rejecter(error);

        return commandWrapper.command.unrecoverable;
    }
}
