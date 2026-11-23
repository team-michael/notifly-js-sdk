import { decryptIdentity, encryptIdentity } from './IdentityCrypto';
import { openStorageDatabase, storageTransaction } from './StorageDatabase';
import {
    CONFIG_STORE,
    LEGACY_STORE,
    PROTECTED_STORE,
    PROTECTED_KEYS,
    STATE_KEY,
    ProtectedSnapshot,
    ProtectedValues,
    ProtectedEnvelope,
    ProtectedStorageError,
} from './ProtectedStorageTypes';

type StoredRecord = { key?: CryptoKey; record?: ProtectedEnvelope; status?: string };
export class ProtectedIdentityStore {
    constructor(public readonly dbName = 'notifly') {}

    async raw(): Promise<StoredRecord | null> {
        const db = await openStorageDatabase(this.dbName);
        if (!db.objectStoreNames.contains(PROTECTED_STORE)) {
            const malformed = db.objectStoreNames.contains(CONFIG_STORE);
            db.close();
            if (malformed) throw new ProtectedStorageError('KEY_MISSING');
            return null;
        }
        return storageTransaction(db, [PROTECTED_STORE], 'readonly', (tx, result) => {
            const s = tx.objectStore(PROTECTED_STORE),
                value: StoredRecord = {};
            for (const key of ['key', 'record', 'status'] as const) {
                const r = s.get(key);
                r.onsuccess = () => {
                    Object.assign(value, { [key]: r.result });
                };
            }
            result(value);
        });
    }

    async read(): Promise<ProtectedSnapshot | null> {
        for (let attempt = 0; attempt < 4; attempt++) {
            const raw = await this.raw();
            if (!raw) return null;
            if (raw.status !== 'ready' && raw.status !== 'pending')
                throw new ProtectedStorageError('UNSUPPORTED_VERSION');
            const snapshot = await this.decode(raw);
            if (raw.status === 'ready') return snapshot;
            try {
                // A compatible worker can finish a validated pending record without plaintext fallback.
                await this.finish(snapshot);
                return snapshot;
            } catch (error) {
                if (!(error instanceof ProtectedStorageError) || error.code !== 'REVISION_CONFLICT' || attempt === 3)
                    throw error;
            }
        }
        throw new ProtectedStorageError('REVISION_CONFLICT');
    }

    async decode(raw: StoredRecord): Promise<ProtectedSnapshot> {
        if (!raw.key || !raw.record) throw new ProtectedStorageError('KEY_MISSING');
        for (let attempt = 1; attempt <= 4; attempt++) {
            if (!raw.key || !raw.record) throw new ProtectedStorageError('KEY_MISSING');
            try {
                const values = await decryptIdentity(raw.record, raw.key);
                return { revision: raw.record.revision, values };
            } catch (error) {
                if (!(error instanceof ProtectedStorageError) || error.code !== 'DECRYPT_FAILED') throw error;
                if (attempt === 4) {
                    console.warn('[Notifly storage]', { code: error.code, attempts: attempt });
                    throw error;
                }
                // Re-read persisted data; never manufacture a replacement key.
                const current = await this.raw();
                if (!current?.key || !current.record) throw new ProtectedStorageError('KEY_MISSING');
                raw = current;
            }
        }
        throw new ProtectedStorageError('DECRYPT_FAILED');
    }

    async patch(patch: Partial<ProtectedValues>, expectedRevision: number): Promise<ProtectedSnapshot> {
        const raw = await this.raw();
        if (!raw?.key || !raw.record || raw.status !== 'ready') throw new ProtectedStorageError('KEY_MISSING');
        const snapshot = await this.decode(raw);
        if (snapshot.revision !== expectedRevision) throw new ProtectedStorageError('REVISION_CONFLICT');
        const values = { ...snapshot.values, ...patch };
        const record = await encryptIdentity(values, raw.key, { ...raw.record, revision: expectedRevision + 1 });
        const db = await openStorageDatabase(this.dbName);
        await storageTransaction<void>(db, [PROTECTED_STORE], 'readwrite', (tx, result, fail) => {
            const store = tx.objectStore(PROTECTED_STORE),
                current = store.get('record');
            current.onsuccess = () => {
                if (current.result?.revision !== expectedRevision) {
                    fail(new ProtectedStorageError('REVISION_CONFLICT'));
                    return;
                }
                store.put(record, 'record');
                result(undefined);
            };
        });
        return { revision: record.revision, values };
    }

    async configuration(keys: string[]): Promise<Array<string | null>> {
        const db = await openStorageDatabase(this.dbName);
        const name = db.objectStoreNames.contains(CONFIG_STORE) ? CONFIG_STORE : LEGACY_STORE;
        return storageTransaction(db, [name], 'readonly', (tx, result) => {
            const values: Array<string | null> = keys.map(() => null);
            keys.forEach((key, index) => {
                const r = tx.objectStore(name).get(key);
                r.onsuccess = () => {
                    values[index] = typeof r.result === 'string' ? r.result : null;
                };
            });
            result(values);
        });
    }

    async writeConfiguration(entries: Array<[string, string | null]>): Promise<void> {
        const db = await openStorageDatabase(this.dbName);
        const name = db.objectStoreNames.contains(CONFIG_STORE) ? CONFIG_STORE : LEGACY_STORE;
        return storageTransaction(db, [name], 'readwrite', (tx, result, fail) => {
            for (const [key, value] of entries) {
                if (key in PROTECTED_KEYS || key === STATE_KEY) {
                    fail(new ProtectedStorageError('INVALID_IDENTITY'));
                    return;
                }
                if (value === null) tx.objectStore(name).delete(key);
                else tx.objectStore(name).put(value, key);
            }
            result(undefined);
        });
    }

    async stage(key: CryptoKey, record: ProtectedEnvelope, expectedLegacy: Array<string | null>): Promise<void> {
        const existing = await openStorageDatabase(this.dbName);
        if (existing.objectStoreNames.contains(PROTECTED_STORE)) {
            existing.close();
            return;
        }
        const nextVersion = existing.version + 1;
        existing.close();
        const db = await openStorageDatabase(this.dbName, nextVersion, (db, tx) => {
            if (!db.objectStoreNames.contains(LEGACY_STORE) || db.objectStoreNames.contains(CONFIG_STORE)) {
                tx.abort();
                return;
            }
            const legacy = tx.objectStore(LEGACY_STORE);
            // Recheck the source inside the exclusive versionchange transaction.
            const keys = Object.keys(PROTECTED_KEYS);
            let remaining = keys.length;
            const values: Array<string | null> = keys.map(() => null);
            keys.forEach((name, index) => {
                const r = legacy.get(name);
                r.onsuccess = () => {
                    values[index] = typeof r.result === 'string' ? r.result : null;
                    if (--remaining !== 0) return;
                    if (values.some((v, i) => v !== expectedLegacy[i])) {
                        tx.abort();
                        return;
                    }
                    legacy.name = CONFIG_STORE;
                    const store = db.createObjectStore(PROTECTED_STORE);
                    store.put(key, 'key');
                    store.put(record, 'record');
                    store.put('pending', 'status');
                };
            });
        });
        db.close();
    }

    async finish(snapshot: ProtectedSnapshot): Promise<void> {
        const db = await openStorageDatabase(this.dbName);
        return storageTransaction(db, [PROTECTED_STORE, CONFIG_STORE], 'readwrite', (tx, result, fail) => {
            const store = tx.objectStore(PROTECTED_STORE),
                record = store.get('record');
            record.onsuccess = () => {
                if (record.result?.revision !== snapshot.revision) {
                    fail(new ProtectedStorageError('REVISION_CONFLICT'));
                    return;
                }
                const config = tx.objectStore(CONFIG_STORE);
                [...Object.keys(PROTECTED_KEYS), STATE_KEY].forEach((key) => config.delete(key));
                store.put('ready', 'status');
                result(undefined);
            };
        });
    }
}
