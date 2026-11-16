import {
    initialize,
    trackEvent,
    setUserId,
    removeUserId,
    setUserProperties,
    setEmail,
    setPhoneNumber,
    setTimezone,
    getUserId,
    getUserProperties,
    requestPermission,
    setPopupActionHandler,
    setSdkType,
    setSdkVersion,
    setSource,
    getSdkVersion,
} from './Client';

const notifly = {
    initialize,
    trackEvent,
    setUserId,
    removeUserId,
    setUserProperties,
    setEmail,
    setPhoneNumber,
    setTimezone,
    getUserId,
    getUserProperties,
    requestPermission,
    setPopupActionHandler,
    setSdkType,
    setSdkVersion,
    setSource,
    getSdkVersion,
};

export type { PopupActionEvent, PopupActionHandler } from './Core/WebMessages/Scheduler';

export default notifly;
