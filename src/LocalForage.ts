import * as localForage from 'localforage';

localForage.config({
    name: 'notifly',
    storeName: 'notiflyconfig',
    version: 1.0,
});

export default localForage;
