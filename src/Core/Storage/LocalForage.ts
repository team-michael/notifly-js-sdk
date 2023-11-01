import localForage from 'localforage';

localForage.config({
    driver: localForage.INDEXEDDB, // This should be forced to IndexedDB because service worker is using IndexedDB
    name: 'notifly',
    storeName: 'notiflyconfig',
    version: 1.0,
});

export default localForage;
