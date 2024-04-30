export default class NotiflyIndexedDBStore {
    private _dbName: string;
    private _storeName: string;

    private _db: IDBDatabase | null = null;

    constructor(dbName: string, storeName: string, version?: number) {
        this._dbName = dbName;
        this._storeName = storeName;
    }

    async ready() {
        await this._open();
    }

    async getItem(key: string): Promise<any> {
        await this.ready();

        return new Promise<any>((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const transaction = this._db!.transaction([this._storeName], 'readonly');
            const store = transaction.objectStore(this._storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject((event.target as IDBRequest).error);
        });
    }

    async setItem(key: string, value: string): Promise<void> {
        await this.ready();

        return new Promise<void>((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const transaction = this._db!.transaction([this._storeName], 'readwrite');
            const store = transaction.objectStore(this._storeName);
            const request = store.put(value, key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                reject((event.target as IDBRequest).error);
            };
        });
    }

    async setItems(entries: [string, string][]): Promise<void> {
        await this.ready();

        return new Promise<void>((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const transaction = this._db!.transaction([this._storeName], 'readwrite');
            const store = transaction.objectStore(this._storeName);
            entries.forEach(([key, value]) => {
                store.put(value, key);
            });

            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = (event) => {
                reject((event.target as IDBRequest).error);
            };
        });
    }

    async removeItem(key: string) {
        await this.ready();

        return new Promise<void>((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const transaction = this._db!.transaction([this._storeName], 'readwrite');
            const store = transaction.objectStore(this._storeName);
            const request = store.delete(key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                reject((event.target as IDBRequest).error);
            };
        });
    }

    async removeItems(keys: string[]) {
        await this.ready();

        return new Promise<void>((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const transaction = this._db!.transaction([this._storeName], 'readwrite');
            const store = transaction.objectStore(this._storeName);
            keys.forEach((key) => {
                store.delete(key);
            });

            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = (event) => {
                reject((event.target as IDBRequest).error);
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
                if (!this._db.objectStoreNames.contains(this._storeName)) {
                    this._db.createObjectStore(this._storeName);
                }
            };
        });
    }
}
