import { LEGACY_STORE, ProtectedStorageError } from './ProtectedStorageTypes';

const TIMEOUT_MS = 1000;
export function openStorageDatabase(
    name: string,
    version?: number,
    upgrade?: (db: IDBDatabase, tx: IDBTransaction) => void
): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') return Promise.reject(new ProtectedStorageError('UNSUPPORTED_ENVIRONMENT'));
    return new Promise((resolve, reject) => {
        let expired = false,
            blocked = false;
        let upgradeTransaction: IDBTransaction | null = null;
        const request = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
        const timer = setTimeout(() => {
            expired = true;
            try {
                upgradeTransaction?.abort();
            } catch {
                /* A completed transaction is reconciled on the next read. */
            }
            reject(new ProtectedStorageError(blocked ? 'MIGRATION_BLOCKED' : 'TIMEOUT'));
        }, TIMEOUT_MS);
        request.onblocked = () => {
            blocked = true;
        };
        request.onupgradeneeded = () => {
            upgradeTransaction = request.transaction;
            if (expired) {
                request.transaction?.abort();
                return;
            }
            if (upgrade) upgrade(request.result, request.transaction!);
            else if (request.result.version === 1 && request.result.objectStoreNames.length === 0) {
                request.result.createObjectStore(LEGACY_STORE);
            }
        };
        request.onerror = () => {
            clearTimeout(timer);
            reject(new ProtectedStorageError('TRANSACTION_FAILED'));
        };
        request.onsuccess = () => {
            clearTimeout(timer);
            if (expired) {
                request.result.close();
                return;
            }
            request.result.onversionchange = () => request.result.close();
            resolve(request.result);
        };
    });
}
export function storageTransaction<T>(
    db: IDBDatabase,
    stores: string[],
    mode: IDBTransactionMode,
    body: (tx: IDBTransaction, result: (value: T) => void, fail: (error: Error) => void) => void
): Promise<T> {
    return new Promise((resolve, reject) => {
        let tx: IDBTransaction;
        let value: T;
        let failure: Error | undefined;
        try {
            tx = db.transaction(stores, mode);
        } catch {
            db.close();
            reject(new ProtectedStorageError('TRANSACTION_FAILED'));
            return;
        }
        const timer = setTimeout(() => {
            failure = new ProtectedStorageError('TIMEOUT');
            try {
                tx.abort();
            } catch {
                /* Already complete. */
            }
        }, TIMEOUT_MS);
        const cleanup = () => {
            clearTimeout(timer);
            db.close();
        };
        tx.oncomplete = () => {
            cleanup();
            resolve(value);
        };
        tx.onerror = () => {
            failure = failure ?? new ProtectedStorageError('TRANSACTION_FAILED');
        };
        tx.onabort = () => {
            cleanup();
            reject(failure ?? new ProtectedStorageError('TRANSACTION_FAILED'));
        };
        try {
            body(
                tx,
                (next) => {
                    value = next;
                },
                (error) => {
                    failure = error;
                    tx.abort();
                }
            );
        } catch {
            failure = new ProtectedStorageError('TRANSACTION_FAILED');
            tx.abort();
        }
    });
}
