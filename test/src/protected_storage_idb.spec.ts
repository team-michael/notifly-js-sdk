/** @jest-environment node */
import 'fake-indexeddb/auto';
import { webcrypto } from 'crypto';
import { ProtectedIdentityStore } from '../../src/Core/Storage/ProtectedIdentityStore';
import { StorageMigration } from '../../src/Core/Storage/StorageMigration';
import { CONFIG_STORE, LEGACY_STORE, PROTECTED_STORE } from '../../src/Core/Storage/ProtectedStorageTypes';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true });
const input = { projectId: 'project', username: 'user', password: 'secret' };
let name: string;
beforeEach(() => {
    name = 'storage-' + Math.random();
});
async function seed(): Promise<void> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open(name);
        r.onupgradeneeded = () => r.result.createObjectStore(LEGACY_STORE);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(LEGACY_STORE, 'readwrite'),
            s = tx.objectStore(LEGACY_STORE);
        s.put('old-device', '__notiflyDeviceID');
        s.put('member', '__notiflyExternalUserID');
        s.put('project', '__notiflyProjectID');
        s.put('old-user', '__notiflyUserName');
        s.put('old-password', '__notiflyPassword');
        s.put('token', '__notiflyCognitoIDToken');
        s.put('123', '__notiflyLastSessionTime');
        s.put('sensitive', '__notiflyState');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}
async function inspect(store: string, key: string): Promise<any> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open(name);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
    const value = await new Promise<any>((resolve, reject) => {
        const tx = db.transaction(store);
        const r = tx.objectStore(store).get(key);
        tx.oncomplete = () => resolve(r.result);
        tx.onerror = () => reject(tx.error);
    });
    db.close();
    return value;
}
async function mutate(store: string, key: string, value?: unknown): Promise<void> {
    const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open(name);
        r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve) => {
        const tx = db.transaction(store, 'readwrite');
        value === undefined ? tx.objectStore(store).delete(key) : tx.objectStore(store).put(value, key);
        tx.oncomplete = () => resolve();
    });
    db.close();
}
test('migration preserves identity and excluded records while deleting plaintext', async () => {
    await seed();
    const store = new ProtectedIdentityStore(name);
    const migration = new StorageMigration(
        store,
        async () => 'not-registered',
        () => 'new-device'
    );
    const result = await migration.initialize(input);
    expect(result.values).toEqual({ ...input, deviceId: 'old-device', externalUserId: 'member' });
    expect(await inspect(CONFIG_STORE, '__notiflyDeviceID')).toBeUndefined();
    expect(await inspect(CONFIG_STORE, '__notiflyState')).toBeUndefined();
    expect(await inspect(CONFIG_STORE, '__notiflyCognitoIDToken')).toBe('token');
    expect(await inspect(CONFIG_STORE, '__notiflyLastSessionTime')).toBe('123');
    expect((await new ProtectedIdentityStore(name).read())?.values.deviceId).toBe('old-device');
});
test('concurrent first initializations select one persisted key and device', async () => {
    const a = new StorageMigration(
        new ProtectedIdentityStore(name),
        async () => 'not-registered',
        () => 'device-a'
    );
    const b = new StorageMigration(
        new ProtectedIdentityStore(name),
        async () => 'not-registered',
        () => 'device-b'
    );
    const [x, y] = await Promise.all([a.initialize(input), b.initialize(input)]);
    expect(x.values.deviceId).toBe(y.values.deviceId);
    expect((await new ProtectedIdentityStore(name).read())?.values.deviceId).toBe(x.values.deviceId);
});
test('compare and swap rejects stale identity updates', async () => {
    const store = new ProtectedIdentityStore(name);
    const first = await new StorageMigration(
        store,
        async () => 'not-registered',
        () => 'device'
    ).initialize(input);
    await store.patch({ externalUserId: 'A' }, first.revision);
    await expect(store.patch({ externalUserId: 'B' }, first.revision)).rejects.toMatchObject({
        code: 'REVISION_CONFLICT',
    });
    expect((await store.read())?.values.externalUserId).toBe('A');
});
test('missing key never creates a replacement visitor', async () => {
    const store = new ProtectedIdentityStore(name);
    const migration = new StorageMigration(
        store,
        async () => 'not-registered',
        () => 'device'
    );
    await migration.initialize(input);
    const before = await inspect(PROTECTED_STORE, 'record');
    await mutate(PROTECTED_STORE, 'key');
    await expect(migration.initialize(input)).rejects.toMatchObject({ code: 'KEY_MISSING' });
    expect(await inspect(PROTECTED_STORE, 'record')).toEqual(before);
    expect(await inspect(PROTECTED_STORE, 'key')).toBeUndefined();
});
test('future version remains untouched', async () => {
    const store = new ProtectedIdentityStore(name);
    const migration = new StorageMigration(
        store,
        async () => 'not-registered',
        () => 'device'
    );
    await migration.initialize(input);
    const future = { ...(await inspect(PROTECTED_STORE, 'record')), schemaVersion: 99 };
    await mutate(PROTECTED_STORE, 'record', future);
    await expect(migration.initialize(input)).rejects.toMatchObject({ code: 'UNSUPPORTED_VERSION' });
    expect(await inspect(PROTECTED_STORE, 'record')).toEqual(future);
});
test('incompatible worker preserves legacy records', async () => {
    await seed();
    const migration = new StorageMigration(
        new ProtectedIdentityStore(name),
        async () => 'blocked',
        () => 'new'
    );
    await expect(migration.initialize(input)).rejects.toMatchObject({ code: 'MIGRATION_BLOCKED' });
    expect(await inspect(LEGACY_STORE, '__notiflyDeviceID')).toBe('old-device');
});
test('decryption is attempted four times without rewriting data', async () => {
    const store = new ProtectedIdentityStore(name);
    await new StorageMigration(
        store,
        async () => 'not-registered',
        () => 'device'
    ).initialize(input);
    const envelope = await inspect(PROTECTED_STORE, 'record');
    const bytes = new Uint8Array(envelope.ciphertext);
    bytes[0] ^= 1;
    await mutate(PROTECTED_STORE, 'record', { ...envelope, ciphertext: bytes.buffer });
    const spy = jest.spyOn(webcrypto.subtle, 'decrypt'),
        log = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(store.read()).rejects.toMatchObject({ code: 'DECRYPT_FAILED' });
    expect(spy).toHaveBeenCalledTimes(4);
    expect(log).toHaveBeenCalledWith('[Notifly storage]', { code: 'DECRYPT_FAILED', attempts: 4 });
    spy.mockRestore();
    log.mockRestore();
});

test('blocked upgrade times out and aborts a late versionchange without altering legacy data', async () => {
    await seed();
    const held = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open(name);
        r.onsuccess = () => resolve(r.result);
    });
    const migration = new StorageMigration(
        new ProtectedIdentityStore(name),
        async () => 'not-registered',
        () => 'new'
    );
    await expect(migration.initialize(input)).rejects.toMatchObject({ code: 'MIGRATION_BLOCKED' });
    held.close();
    expect(await inspect(LEGACY_STORE, '__notiflyDeviceID')).toBe('old-device');
    const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open(name);
        r.onsuccess = () => resolve(r.result);
    });
    expect(db.objectStoreNames.contains(PROTECTED_STORE)).toBe(false);
    db.close();
});
test('interrupted cleanup resumes with the staged ID and never resurrects legacy identity', async () => {
    await seed();
    const store = new ProtectedIdentityStore(name);
    const migration = new StorageMigration(
        store,
        async () => 'not-registered',
        () => 'new'
    );
    const finish = jest.spyOn(store, 'finish').mockRejectedValueOnce(new Error('abort'));
    await expect(migration.initialize(input)).rejects.toThrow('abort');
    expect(await inspect(CONFIG_STORE, '__notiflyDeviceID')).toBe('old-device');
    finish.mockRestore();
    expect((await migration.initialize(input)).values.deviceId).toBe('old-device');
    expect(await inspect(CONFIG_STORE, '__notiflyDeviceID')).toBeUndefined();
    await store.patch({ externalUserId: null }, 1);
    await mutate(CONFIG_STORE, '__notiflyExternalUserID', 'stale-member');
    expect((await migration.initialize(input)).values.externalUserId).toBeNull();
    expect(await inspect(CONFIG_STORE, '__notiflyExternalUserID')).toBeUndefined();
});
test('an aborted encrypted update leaves the previous record readable', async () => {
    const store = new ProtectedIdentityStore(name);
    await new StorageMigration(
        store,
        async () => 'not-registered',
        () => 'device'
    ).initialize(input);
    const original = IDBObjectStore.prototype.put;
    const put = jest
        .spyOn(IDBObjectStore.prototype, 'put')
        .mockImplementation(function (this: IDBObjectStore, value: any, key?: IDBValidKey) {
            if (this.name === PROTECTED_STORE && key === 'record')
                throw new DOMException('Quota exceeded', 'QuotaExceededError');
            return original.call(this, value, key);
        });
    await expect(store.patch({ externalUserId: 'lost' }, 1)).rejects.toMatchObject({ code: 'TRANSACTION_FAILED' });
    put.mockRestore();
    expect((await store.read())?.values.externalUserId).toBeNull();
});

test('a timeout aborts an upgrade that already started', async () => {
    const { openStorageDatabase } = await import('../../src/Core/Storage/StorageDatabase');
    await seed();
    let running = true;
    const opening = openStorageDatabase(name, 2, (_db, tx) => {
        const s = tx.objectStore(LEGACY_STORE);
        s.name = CONFIG_STORE;
        const keepAlive = () => {
            const r = s.get('keepalive');
            r.onsuccess = () => {
                if (running) keepAlive();
            };
        };
        tx.addEventListener('abort', () => {
            running = false;
        });
        keepAlive();
    });
    await expect(opening).rejects.toMatchObject({ code: 'TIMEOUT' });
    running = false;
    expect(await inspect(LEGACY_STORE, '__notiflyDeviceID')).toBe('old-device');
});
test('ready restoration tolerates a single concurrent identity update', async () => {
    const store = new ProtectedIdentityStore(name);
    const migration = new StorageMigration(
        store,
        async () => 'not-registered',
        () => 'device'
    );
    await migration.initialize(input);
    const decode = store.decode.bind(store);
    jest.spyOn(store, 'decode').mockImplementationOnce(async (raw) => {
        const result = await decode(raw);
        await store.patch({ externalUserId: 'B' }, result.revision);
        return result;
    });
    await expect(migration.initialize(input)).resolves.toMatchObject({ revision: 2, values: { externalUserId: 'B' } });
});
test('a worker read can verify and finish an interrupted pending migration', async () => {
    await seed();
    const store = new ProtectedIdentityStore(name);
    const migration = new StorageMigration(
        store,
        async () => 'not-registered',
        () => 'new'
    );
    const finish = jest.spyOn(store, 'finish').mockRejectedValueOnce(new Error('transient cleanup failure'));
    await expect(migration.initialize(input)).rejects.toThrow('transient cleanup failure');
    finish.mockRestore();
    await expect(store.read()).resolves.toMatchObject({ values: { deviceId: 'old-device' } });
    expect(await inspect(PROTECTED_STORE, 'status')).toBe('ready');
    expect(await inspect(CONFIG_STORE, '__notiflyDeviceID')).toBeUndefined();
});
