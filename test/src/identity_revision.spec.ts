import { NotiflyStorage } from '../../src/Core/Storage';
import { ProtectedStorageError, ProtectedSnapshot } from '../../src/Core/Storage/ProtectedStorageTypes';
import { UserIdentityManager } from '../../src/Core/User';
import { UserStateManager } from '../../src/Core/User/State';
import { NotiflyAPI } from '../../src/Core/API';
import { EventLogger } from '../../src/Core/Event';
import { SSEManager } from '../../src/Core/SSE/SSEManager';
import { WebMessageManager } from '../../src/Core/WebMessages/Manager';
import { SdkStateManager, SdkType } from '../../src/Core/SdkState';
jest.mock('../../src/Core/API', () => ({ NotiflyAPI: { call: jest.fn() } }));
jest.mock('../../src/Core/Event', () => ({
    EventLogger: { logEvent: jest.fn() },
    NotiflyInternalEvent: {
        SET_USER_PROPERTIES: 'set_user_properties',
        REMOVE_EXTERNAL_USER_ID: 'remove_external_user_id',
    },
}));
const values = {
    projectId: '0123456789abcdef0123456789abcdef',
    deviceId: 'device',
    externalUserId: 'A',
    username: 'user',
    password: 'password',
};
let persisted: ProtectedSnapshot;
let readRace: (() => void) | undefined;
let afterWrite: (() => void) | undefined;
beforeEach(() => {
    persisted = { revision: 1, values: { ...values } };
    readRace = undefined;
    afterWrite = undefined;
    UserStateManager.identityRevision = 1;
    UserStateManager.userData = {
        platform: 'web',
        sdk_version: 'test',
        sdk_type: 'js',
        external_user_id: 'A',
        user_properties: { name: 'A' },
    };
    SdkStateManager.type = SdkType.JS;
    jest.spyOn(NotiflyStorage, 'getIdentitySnapshot').mockImplementation(async () => {
        const result = persisted;
        readRace?.();
        readRace = undefined;
        return result;
    });
    jest.spyOn(NotiflyStorage, 'getItem').mockImplementation(async (key) => {
        const result =
            key === '__notiflyProjectID'
                ? persisted.values.projectId
                : key === '__notiflyExternalUserID'
                ? persisted.values.externalUserId
                : null;
        if (key === '__notiflyExternalUserID') {
            readRace?.();
            readRace = undefined;
        }
        return result;
    });
    jest.spyOn(NotiflyStorage, 'getNotiflyUserId').mockResolvedValue('legacy-previous');
    jest.spyOn(NotiflyStorage, 'setItem').mockImplementation(async (_key, value) => {
        persisted = { revision: persisted.revision + 1, values: { ...persisted.values, externalUserId: value } };
        afterWrite?.();
    });
    jest.spyOn(NotiflyStorage, 'removeItem').mockImplementation(async () => {
        persisted = { revision: persisted.revision + 1, values: { ...persisted.values, externalUserId: null } };
        afterWrite?.();
    });
    jest.spyOn(NotiflyStorage, 'compareAndSetExternalUserId').mockImplementation(async (value, revision) => {
        if (revision !== persisted.revision) throw new ProtectedStorageError('REVISION_CONFLICT');
        const updated = { revision: revision + 1, values: { ...persisted.values, externalUserId: value } };
        persisted = updated;
        afterWrite?.();
        return updated as any;
    });
    jest.mocked(NotiflyAPI.call).mockResolvedValue({
        userData: { user_properties: { name: 'fresh-B' } },
        campaignData: [],
        eventIntermediateCountsData: [],
    });
    jest.mocked(EventLogger.logEvent).mockClear();
});
afterEach(() => jest.restoreAllMocks());
test.each(['B', null])('a concurrent login is not overwritten by a stale transition to %s', async (target) => {
    readRace = () => {
        persisted = { revision: 2, values: { ...values, externalUserId: 'C' } };
    };
    await expect(UserIdentityManager.setUserId(target)).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    expect(persisted.values.externalUserId).toBe('C');
    expect(EventLogger.logEvent).not.toHaveBeenCalled();
});
test('transition event keeps the committed identity when another tab logs in before logging', async () => {
    afterWrite = () => {
        persisted = { revision: 3, values: { ...values, externalUserId: 'C' } };
    };
    await UserIdentityManager.setUserId('B');
    const call = jest.mocked(EventLogger.logEvent).mock.calls[0] as any[];
    expect(call[5]).toMatchObject({ revision: 2, values: { externalUserId: 'B' } });
    expect(call[1]).toMatchObject({ external_user_id: 'B', previous_external_user_id: 'A' });
    expect(UserStateManager.userData.external_user_id).toBe('C');
});
test('public property reads refresh the current identity', async () => {
    persisted = { revision: 2, values: { ...values, externalUserId: 'B' } };
    expect(await UserIdentityManager.getUserProperties()).toEqual({ name: 'fresh-B' });
});
test('the duplicate window belongs to one identity revision', async () => {
    await UserIdentityManager.setUserProperties({ name: 'fresh-B' });
    persisted = { revision: 2, values: { ...values, externalUserId: 'B' } };
    await UserIdentityManager.setUserProperties({ name: 'fresh-B' });
    expect(EventLogger.logEvent).toHaveBeenCalledTimes(2);
});
test('Cafe24 diffs use the current user properties', async () => {
    SdkStateManager.type = SdkType.JS_CAFE24;
    persisted = { revision: 2, values: { ...values, externalUserId: 'B' } };
    await UserIdentityManager.setUserProperties({ name: 'A' });
    expect(EventLogger.logEvent).toHaveBeenCalledTimes(1);
});
test('server events from the previous SSE connection are discarded', async () => {
    const source = persisted;
    persisted = { revision: 2, values: { ...values, externalUserId: 'B' } };
    const dispatch = jest
        .spyOn(WebMessageManager, 'maybeTriggerWebMessagesAndUpdateEventCounts')
        .mockImplementation(() => undefined);
    jest.spyOn(SSEManager, 'start').mockResolvedValue();
    await (SSEManager as any).dispatchServerEvent('server-purchase', {}, source);
    expect(dispatch).not.toHaveBeenCalled();
});
