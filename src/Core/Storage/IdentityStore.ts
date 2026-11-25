import { decryptIdentity, encryptIdentity, EncryptedIdentity, generateIdentityKey } from './IdentityCrypto';

export interface NotiflyIdentity {
    projectId: string;
    username: string;
    password: string;
    deviceId: string;
    externalUserId: string | null;
}

interface IdentityRecord extends EncryptedIdentity {
    version: 1;
    key: CryptoKey;
}

interface Snapshot {
    record: IdentityRecord | undefined;
    legacy: unknown[];
}

const DATABASE = 'notifly';
const OBJECT_STORE = 'notiflyconfig';
const IDENTITY_KEY = '__notiflyIdentity';
const STATE_KEY = '__notiflyState';
const MAX_ATTEMPTS = 5;
const LEGACY_FIELDS: [keyof NotiflyIdentity, string][] = [
    ['projectId', '__notiflyProjectID'],
    ['username', '__notiflyUserName'],
    ['password', '__notiflyPassword'],
    ['deviceId', '__notiflyDeviceID'],
    ['externalUserId', '__notiflyExternalUserID'],
];

function validateIdentity(value: unknown): NotiflyIdentity {
    if (!value || typeof value !== 'object') {
        throw new Error('[IdentityStore] Invalid identity.');
    }
    const identity = value as NotiflyIdentity;
    for (const [field] of LEGACY_FIELDS) {
        if (field === 'externalUserId' && identity[field] === null) continue;
        if (typeof identity[field] !== 'string' || identity[field]?.length === 0) {
            throw new Error(`[IdentityStore] Invalid identity field: ${field}.`);
        }
    }
    // Only identity fields belong in this encrypted payload.
    return {
        projectId: identity.projectId,
        username: identity.username,
        password: identity.password,
        deviceId: identity.deviceId,
        externalUserId: identity.externalUserId,
    };
}

function isIdentityRecord(value: unknown): value is IdentityRecord {
    if (!value || typeof value !== 'object') return false;
    const record = value as IdentityRecord;
    return (
        record.version === 1 &&
        !!record.key &&
        record.iv instanceof Uint8Array &&
        record.ciphertext instanceof ArrayBuffer
    );
}

function sameRecord(left: IdentityRecord | undefined, right: IdentityRecord | undefined): boolean {
    if (left === undefined || right === undefined) return left === right;
    if (!isIdentityRecord(left) || !isIdentityRecord(right)) return false;
    const sameBytes = (a: Uint8Array, b: Uint8Array) =>
        a.length === b.length && a.every((byte, index) => byte === b[index]);
    return sameBytes(left.iv, right.iv) && sameBytes(new Uint8Array(left.ciphertext), new Uint8Array(right.ciphertext));
}

/** Identity storage shared by pages and workers; importing it does not open or migrate IndexedDB. */
export default class IdentityStore {
    /** Call only after the active push worker supports encrypted identities. */
    async initialize(): Promise<NotiflyIdentity | null> {
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            let snapshot = await this._read();
            const identity = await this._decode(snapshot);
            if (!identity) return null;

            if (snapshot.record === undefined) {
                const key = await generateIdentityKey();
                const record = await this._encrypt(identity, key);
                if (!(await this._commit(snapshot, (store) => store.put(record, IDENTITY_KEY)))) continue;

                // Verify the committed, structured-cloned key and ciphertext before deleting plaintext.
                snapshot = await this._read();
                if (!sameRecord(snapshot.record, record)) continue;
                const restored = await this._decode(snapshot);
                if (JSON.stringify(restored) !== JSON.stringify(identity)) {
                    throw new Error('[IdentityStore] Identity verification failed.');
                }
            }

            if (
                await this._commit(snapshot, (store) => {
                    LEGACY_FIELDS.forEach(([, key]) => store.delete(key));
                    store.delete(STATE_KEY);
                })
            )
                return identity;
        }
        throw new Error('[IdentityStore] Identity changed during migration. Retry initialization.');
    }

    /** Read-only, including legacy fallback before migration. Corrupt encrypted data never falls back. */
    async getIdentity(): Promise<NotiflyIdentity | null> {
        return this._decode(await this._read());
    }

    /** Replaces the complete identity. The caller supplies IDs; this store never generates a visitor ID. */
    async setIdentity(value: NotiflyIdentity): Promise<void> {
        await this.updateIdentity(() => value);
    }

    /** Retries partial changes against the latest identity; encrypted records never return to plaintext. */
    async updateIdentity(
        update: (current: NotiflyIdentity | null) => NotiflyIdentity | null,
        encrypt = true
    ): Promise<void> {
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const snapshot = await this._read();
            const next = update(await this._decode(snapshot));
            if (!next) return;
            const identity = validateIdentity(next);
            const record =
                encrypt || snapshot.record !== undefined
                    ? await this._encrypt(identity, snapshot.record?.key ?? (await generateIdentityKey()))
                    : undefined;
            if (
                await this._commit(snapshot, (store) => {
                    if (record) {
                        store.put(record, IDENTITY_KEY);
                    } else {
                        LEGACY_FIELDS.forEach(([field, key]) => {
                            if (identity[field] === null) store.delete(key);
                            else store.put(identity[field], key);
                        });
                    }
                })
            ) {
                if (record) await this.initialize();
                return;
            }
        }
        throw new Error('[IdentityStore] Identity changed during save. Retry the operation.');
    }

    private async _decode(snapshot: Snapshot): Promise<NotiflyIdentity | null> {
        if (snapshot.record !== undefined) {
            if (!isIdentityRecord(snapshot.record)) {
                throw new Error('[IdentityStore] Invalid or unsupported encrypted identity.');
            }
            const plaintext = await decryptIdentity(snapshot.record, snapshot.record.key);
            return validateIdentity(JSON.parse(plaintext));
        }
        if (snapshot.legacy.every((value) => value === undefined)) return null;
        const identity: Record<string, unknown> = {};
        LEGACY_FIELDS.forEach(([field], index) => {
            identity[field] = snapshot.legacy[index] ?? null;
        });
        return validateIdentity(identity);
    }

    private async _encrypt(identity: NotiflyIdentity, key: CryptoKey): Promise<IdentityRecord> {
        return { version: 1, key, ...(await encryptIdentity(JSON.stringify(identity), key)) };
    }

    private _read(): Promise<Snapshot> {
        return this._transaction('readonly', (store, done) => this._readSnapshot(store, done));
    }

    private _readSnapshot(store: IDBObjectStore, done: (snapshot: Snapshot) => void): void {
        const keys = [IDENTITY_KEY, ...LEGACY_FIELDS.map(([, key]) => key)];
        const values: unknown[] = new Array(keys.length);
        let remaining = keys.length;
        keys.forEach((key, index) => {
            const request = store.get(key);
            request.onsuccess = () => {
                values[index] = request.result;
                if (--remaining === 0) {
                    done({ record: values[0] as IdentityRecord | undefined, legacy: values.slice(1) });
                }
            };
        });
    }

    private _commit(expected: Snapshot, write: (store: IDBObjectStore) => void): Promise<boolean> {
        return this._transaction('readwrite', (store, done) => {
            this._readSnapshot(store, (current) => {
                if (
                    !sameRecord(current.record, expected.record) ||
                    !current.legacy.every((value, index) => value === expected.legacy[index])
                ) {
                    done(false);
                    return;
                }
                // Crypto runs outside the transaction. Recheck and write synchronously to avoid auto-commit.
                write(store);
                done(true);
            });
        });
    }

    private _transaction<T>(
        mode: IDBTransactionMode,
        work: (store: IDBObjectStore, done: (result: T) => void) => void
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DATABASE);
            let blocked = false;
            request.onerror = () => reject(request.error);
            request.onblocked = () => {
                blocked = true;
                reject(new Error('[IdentityStore] Database open is blocked.'));
            };
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(OBJECT_STORE)) {
                    request.result.createObjectStore(OBJECT_STORE);
                }
            };
            request.onsuccess = () => {
                const db = request.result;
                if (blocked) {
                    db.close();
                    return;
                }
                db.onversionchange = () => db.close();
                let transaction: IDBTransaction;
                try {
                    transaction = db.transaction(OBJECT_STORE, mode);
                } catch (error) {
                    db.close();
                    reject(error);
                    return;
                }
                let result: T;
                transaction.oncomplete = () => {
                    db.close();
                    resolve(result);
                };
                transaction.onabort = () => {
                    db.close();
                    reject(transaction.error || new Error('[IdentityStore] Transaction aborted.'));
                };
                try {
                    work(transaction.objectStore(OBJECT_STORE), (value) => {
                        result = value;
                    });
                } catch (error) {
                    transaction.abort();
                    reject(error);
                }
            };
        });
    }
}
