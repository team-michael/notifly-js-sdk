import { SdkStateManager, SdkStateObserver } from '../SdkState';

export default class NotiflyIndexedDBStore implements SdkStateObserver {
    private _dbName: string;
    private _storeName: string;

    private _db: IDBDatabase | null = null;
    private _activeTransactions: IDBTransaction[] = [];

    constructor(dbName: string, storeName: string) {
        this._dbName = dbName;
        this._storeName = storeName;
        SdkStateManager.registerObserver(this);
    }

    onTerminated() {
        this._onWindowUnload.call(this);
    }

    async ready() {
        await this._open();
    }

    async getItem(key: string): Promise<any> {
        await this.ready();

        return new Promise<any>((resolve, reject) => {
            const transaction = this._getTransaction('readonly');
            this._activeTransactions.push(transaction);

            const store = transaction.objectStore(this._storeName);
            const request = store.get(key);

            transaction.oncomplete = () => {
                this._removeTransaction(transaction);
            };
            transaction.onerror = () => {
                this._removeTransaction(transaction);
            };
            transaction.onabort = () => {
                reject('Transaction aborted');
                this._removeTransaction(transaction);
            };

            request.onsuccess = () => {
                resolve(request.result);
            };
            request.onerror = (event) => {
                reject((event.target as IDBRequest).error);
            };
        });
    }

    async setItem(key: string, value: string): Promise<void> {
        await this.ready();

        return new Promise<void>((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const transaction = this._getTransaction('readwrite');
            const store = transaction.objectStore(this._storeName);
            store.put(value, key);
            this._activeTransactions.push(transaction);

            transaction.oncomplete = () => {
                this._removeTransaction(transaction);
                resolve();
            };
            transaction.onerror = (event) => {
                this._removeTransaction(transaction);
                reject((event.target as IDBRequest).error);
            };
            transaction.onabort = () => {
                reject('Transaction aborted');
                this._removeTransaction(transaction);
            };
        });
    }

    async setItems(entries: [string, string][]): Promise<void> {
        await this.ready();

        return new Promise<void>((resolve, reject) => {
            const transaction = this._getTransaction('readwrite');
            const store = transaction.objectStore(this._storeName);
            entries.forEach(([key, value]) => {
                store.put(value, key);
            });
            this._activeTransactions.push(transaction);

            transaction.oncomplete = () => {
                this._removeTransaction(transaction);
                resolve();
            };
            transaction.onerror = (event) => {
                this._removeTransaction(transaction);
                reject((event.target as IDBRequest).error);
            };
            transaction.onabort = () => {
                reject('Transaction aborted');
                this._removeTransaction(transaction);
            };
        });
    }

    async removeItem(key: string) {
        await this.ready();

        return new Promise<void>((resolve, reject) => {
            const transaction = this._getTransaction('readwrite');
            const store = transaction.objectStore(this._storeName);
            store.delete(key);
            this._activeTransactions.push(transaction);

            transaction.oncomplete = () => {
                this._removeTransaction(transaction);
                resolve();
            };
            transaction.onerror = (event) => {
                this._removeTransaction(transaction);
                reject((event.target as IDBRequest).error);
            };
            transaction.onabort = () => {
                reject('Transaction aborted');
                this._removeTransaction(transaction);
            };
        });
    }

    async removeItems(keys: string[]) {
        await this.ready();

        return new Promise<void>((resolve, reject) => {
            const transaction = this._getTransaction('readwrite');
            const store = transaction.objectStore(this._storeName);
            keys.forEach((key) => {
                store.delete(key);
            });
            this._activeTransactions.push(transaction);

            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = (event) => {
                reject((event.target as IDBRequest).error);
            };
            transaction.onabort = () => {
                reject('Transaction aborted');
                this._removeTransaction(transaction);
            };
        });
    }

    private async _open(): Promise<IDBDatabase> {
        if (this._db) {
            return this._db;
        }

        return new Promise<IDBDatabase>((resolve, reject) => {
            const openRequest = indexedDB.open(this._dbName);

            openRequest.onerror = (event) => {
                reject((event.target as IDBOpenDBRequest).error);
            };

            openRequest.onsuccess = (event) => {
                this._db = (event.target as IDBOpenDBRequest).result;
                resolve(this._db);
            };

            openRequest.onupgradeneeded = (event) => {
                this._db = (event.target as IDBOpenDBRequest).result;
                this._db.onversionchange = () => {
                    this._db?.close();
                    console.warn('[NotiflyIndexedDBStore] Database version changed. Closing the connection.');
                };
                if (!this._db.objectStoreNames.contains(this._storeName)) {
                    this._db.createObjectStore(this._storeName);
                }
            };
        });
    }

    private _abortActiveTransactions() {
        this._activeTransactions.forEach((transaction) => {
            try {
                transaction.abort();
            } catch (e) {
                /* Do nothing */
            }
        });
    }

    private _getTransaction(mode: IDBTransactionMode) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        try {
            return this._db!.transaction([this._storeName], mode);
        } catch (e) {
            throw new Error(
                '[Notifly] Transaction interrupted unexpectedly. This is mostly due to the database being closed by the sudden browser shutdown.'
            );
        }
    }

    private _removeTransaction(transaction: IDBTransaction) {
        const index = this._activeTransactions.indexOf(transaction);
        if (index >= 0) {
            this._activeTransactions.splice(index, 1);
        }
    }

    private _onWindowUnload() {
        if (this._db) {
            try {
                this._abortActiveTransactions();
                this._db.close();
            } catch (e) {
                /* Do nothing */
            }
        }
    }
}
