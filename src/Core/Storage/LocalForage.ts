import localForage from 'localforage';

export default localForage.createInstance({
    driver: localForage.INDEXEDDB, // This should be forced to IndexedDB because service worker is using IndexedDB
    name: 'notifly',
    storeName: 'notiflyconfig',
    version: 1.0,
});
