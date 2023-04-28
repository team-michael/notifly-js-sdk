const { v5 } = require('uuid');
function getNotiflyUserID(deviceToken) {
    const externalUserID = localStorage.getItem('__notiflyExternalUserID');
    if (externalUserID) {
        return v5(externalUserID, NAMESPACE.REGISTERED_USERID);
    }
    return v5(deviceToken, NAMESPACE.UNREGISTERED_USERID);
}
module.exports = {
    getNotiflyUserID,
}
