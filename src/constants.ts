// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'SDK_VERSIO... Remove this comment to see the full error message
const SDK_VERSION = '1.0.4';

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NAMESPACE'... Remove this comment to see the full error message
const NAMESPACE = {
    'EVENTID': '830b5f7b-e392-43db-a17b-d835f0bcab2b',
    'REGISTERED_USERID': 'ce7c62f9-e8ae-4009-8fd6-468e9581fa21',
    'UNREGISTERED_USERID': 'a6446dcf-c057-4de7-a360-56af8659d52f',
    'DEVICEID': '830848b3-2444-467d-9cd8-3430d2738c57',
};

// @ts-expect-error TS(2580): Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = {
    SDK_VERSION,
    NAMESPACE,
};
