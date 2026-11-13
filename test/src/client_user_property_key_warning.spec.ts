import { setEmail, setPhoneNumber, setTimezone, setUserProperties } from '../../src/Client';
import { CommandManager } from '../../src/Core/Command';
import { SdkState, SdkStateManager } from '../../src/Core/SdkState';
import { UserIdentityManager } from '../../src/Core/User';

describe('user property key warnings', () => {
    let warn: jest.SpyInstance;
    let forward: jest.SpyInstance;

    beforeEach(() => {
        SdkStateManager.state = SdkState.READY;
        warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        forward = jest.spyOn(UserIdentityManager, 'setUserProperties').mockResolvedValue(undefined);
        jest.spyOn(CommandManager.getInstance(), 'dispatch').mockImplementation((command) => command.execute());
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('forwards valid keys without a warning', async () => {
        const params = Object.freeze({ user_name: 'Kim', purchase_count_30d: 3 });
        await setUserProperties(params);
        expect(warn).not.toHaveBeenCalled();
        expect(forward.mock.calls[0][0]).toBe(params);
    });

    test('combines invalid keys into one warning and preserves values and nested keys', async () => {
        const params = Object.freeze({
            valid_key: '홍길동.$',
            'first.name': null,
            '사용자명': 'private-value',
            profile: { 'nested.key': 'nested-value' },
        });
        await setUserProperties(params);
        expect(warn).toHaveBeenCalledTimes(1);
        const message = warn.mock.calls[0][0];
        expect(message).toContain('["first.name","사용자명"]');
        expect(message).toContain('A-Z, a-z');
        expect(message).toContain('0-9');
        expect(message).toContain('underscores (_)');
        expect(message).toContain('does not block');
        expect(message).not.toMatch(/private-value|홍길동|nested/);
        expect(forward.mock.calls[0][0]).toBe(params);
    });

    test('does not warn about object values or special characters in values', async () => {
        await setUserProperties({ name: '홍길동.$', profile: { 'first.name': 'Kim' } });
        expect(warn).not.toHaveBeenCalled();
    });

    test('warns again for each call with the same invalid key', async () => {
        await setUserProperties({ 'first.name': 'Kim' });
        await setUserProperties({ 'first.name': 'Kim' });
        expect(warn).toHaveBeenCalledTimes(2);
        expect(forward).toHaveBeenCalledTimes(2);
    });

    test('does not duplicate the key warning when an invalid timezone is omitted', async () => {
        const params = Object.freeze({ $timezone: 'Invalid/Timezone', 'first.name': 'Kim' });
        await setUserProperties(params);
        expect(warn.mock.calls.filter(([message]) => message.includes('custom user property key'))).toHaveLength(1);
        expect(forward).toHaveBeenCalledTimes(1);
        expect(forward).toHaveBeenCalledWith({ 'first.name': 'Kim' });
        expect(params.$timezone).toBe('Invalid/Timezone');
    });

    test('keeps the built-in convenience setters free of key warnings', async () => {
        await setEmail('a@example.com');
        await setPhoneNumber('01012345678');
        await setTimezone('Asia/Seoul');
        expect(warn).not.toHaveBeenCalled();
        expect(forward).toHaveBeenCalledTimes(3);
    });

    test('escapes control characters and quotes in the warning', async () => {
        await setUserProperties({ 'name\n"\t': 'secret' });
        expect(warn.mock.calls[0][0]).toContain('["name\\n\\"\\t"]');
        expect(warn.mock.calls[0][0]).not.toMatch(/[\n\r\t]/);
    });
});
