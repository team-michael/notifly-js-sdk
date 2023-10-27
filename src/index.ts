import { initialize, trackEvent, setSdkType, setSource } from './Client';
import { setUserId, setUserProperties, getUserId, getUserProperties, deleteUser } from './Client/User';
import { setDeviceToken } from './Client/Device';

const notifly = {
    initialize,
    trackEvent,
    setUserProperties,
    deleteUser,
    setUserId,
    setDeviceToken,
    setSdkType,
    setSource,
    getUserId,
    getUserProperties,
};

export default notifly;
