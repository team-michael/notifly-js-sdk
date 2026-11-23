import { UserStateManager } from '../../src/Core/User/State';
import { NotiflyStorage } from '../../src/Core/Storage';
import { NotiflyAPI } from '../../src/Core/API';
jest.mock('../../src/Core/API', () => ({ NotiflyAPI: { call: jest.fn() } }));
jest.mock('../../src/Core/Storage', () => ({
    ...jest.requireActual('../../src/Core/Storage'),
    NotiflyStorage: {
        getItem: jest.fn(),
        getItems: jest.fn(),
        getNotiflyUserId: jest.fn(),
        setItem: jest.fn(),
        getIdentitySnapshot: jest.fn(),
        compareAndSetExternalUserId: jest.fn(),
    },
}));
const values = {
    projectId: '0123456789abcdef0123456789abcdef',
    deviceId: 'device',
    externalUserId: null,
    username: 'user',
    password: 'password',
};
beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(NotiflyStorage.getItems).mockResolvedValue([values.projectId, values.deviceId, null]);
    jest.mocked(NotiflyStorage.getItem).mockResolvedValue(null);
    jest.mocked(NotiflyStorage.getNotiflyUserId).mockResolvedValue('user-id');
    (NotiflyStorage as any).getIdentitySnapshot.mockResolvedValue({ revision: 1, values });
    jest.mocked(NotiflyAPI.call).mockResolvedValue({
        userData: { user_properties: { name: 'fresh' } },
        campaignData: [],
        eventIntermediateCountsData: [],
    });
});
test('sync and local updates never persist user state', async () => {
    await UserStateManager.sync({});
    UserStateManager.updateUserProperties({ private: 'value' });
    UserStateManager.updateEventCounts('purchase', { amount: 1 });
    UserStateManager.updateCampaignHiddenUntilData({ campaign: 123 });
    expect(NotiflyStorage.setItem).not.toHaveBeenCalled();
});
test('even a valid legacy cache cannot suppress the initial server request', async () => {
    jest.mocked(NotiflyStorage.getItem).mockImplementation(async (key) =>
        key === '__notiflyState'
            ? JSON.stringify({
                  userData: { external_user_id: null, user_properties: { name: 'stale' } },
                  inWebMessageCampaigns: [],
                  eventIntermediateCounts: [],
              })
            : null
    );
    await UserStateManager.sync({});
    expect(NotiflyAPI.call).toHaveBeenCalledTimes(1);
    expect(UserStateManager.userData.user_properties).toEqual({ name: 'fresh' });
});

test('a stale user-state response is discarded and the current user is fetched', async () => {
    let release!: (value: any) => void;
    jest.mocked(NotiflyAPI.call).mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                release = resolve;
            })
    );
    const syncing = UserStateManager.sync({});
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    (NotiflyStorage as any).getIdentitySnapshot.mockResolvedValue({
        revision: 2,
        values: { ...values, externalUserId: 'B' },
    });
    release({ userData: { user_properties: { name: 'A' } }, campaignData: [], eventIntermediateCountsData: [] });
    await syncing;
    expect(NotiflyAPI.call).toHaveBeenCalledTimes(2);
    expect(UserStateManager.userData.user_properties).toEqual({ name: 'fresh' });
    expect(UserStateManager.userData.external_user_id).toBe('B');
    expect(UserStateManager.identityRevision).toBe(2);
});
test('logout cleanup retains the refreshed anonymous campaigns', () => {
    const campaigns = [{ id: 'anonymous-campaign' }] as any;
    UserStateManager.inWebMessageCampaigns = campaigns;
    UserStateManager.clearAll();
    expect(UserStateManager.inWebMessageCampaigns).toBe(campaigns);
});

test('a server identity correction CAS conflict refetches instead of failing initialization', async () => {
    (NotiflyStorage as any).getIdentitySnapshot.mockResolvedValue({
        revision: 1,
        values: { ...values, externalUserId: 'A' },
    });
    jest.mocked(NotiflyAPI.call).mockResolvedValueOnce({
        userData: { device_external_user_id: 'server-A' },
        campaignData: [],
        eventIntermediateCountsData: [],
    });
    jest.mocked(NotiflyStorage.compareAndSetExternalUserId).mockImplementationOnce(async () => {
        (NotiflyStorage as any).getIdentitySnapshot.mockResolvedValue({
            revision: 2,
            values: { ...values, externalUserId: 'B' },
        });
        const { ProtectedStorageError } = await import('../../src/Core/Storage/ProtectedStorageTypes');
        throw new ProtectedStorageError('REVISION_CONFLICT');
    });
    await expect(UserStateManager.sync({ handleExternalUserIdMismatch: true })).resolves.toBeUndefined();
    expect(UserStateManager.userData.external_user_id).toBe('B');
});
