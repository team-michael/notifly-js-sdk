import { CommandManager } from '../../src/Core/Command';
import { CommandType } from '../../src/Core/Command/Commands';
import { SdkState, SdkStateManager } from '../../src/Core/SdkState';
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
beforeEach(() => {
    SdkStateManager.state = SdkState.TERMINATED;
    SdkStateManager.state = SdkState.NOT_INITIALIZED;
});
afterEach(() => {
    SdkStateManager.state = SdkState.TERMINATED;
});
test('failed initialization settles pending commands', async () => {
    const manager = new CommandManager();
    let outcome = 'pending';
    void manager.dispatch({ type: CommandType.TRACK_EVENT, unrecoverable: false, execute: async () => undefined }).then(
        () => {
            outcome = 'resolved';
        },
        () => {
            outcome = 'rejected';
        }
    );
    SdkStateManager.state = SdkState.FAILED;
    await tick();
    expect(outcome).toBe('rejected');
});
test('a recoverable queued error does not strand later commands', async () => {
    const manager = new CommandManager(),
        completed: string[] = [];
    void manager
        .dispatch({
            type: CommandType.TRACK_EVENT,
            unrecoverable: false,
            execute: async () => {
                throw new Error('temporary');
            },
        })
        .catch(() => undefined);
    void manager
        .dispatch({
            type: CommandType.TRACK_EVENT,
            unrecoverable: false,
            execute: async () => {
                completed.push('next');
            },
        })
        .catch(() => undefined);
    SdkStateManager.state = SdkState.READY;
    await tick();
    expect(completed).toEqual(['next']);
});
