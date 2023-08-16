import { NotiflyStorage, NotiflyStorageKeys } from '../Storage';
import { SdkStateManager } from '../SdkStateManager';
import { WebMessageManager } from '../WebMessages/Manager';

export class WindowEventManager {
    static initialize() {
        if (typeof window === 'undefined') {
            return;
        }

        window.addEventListener('beforeunload', () => {
            if (!SdkStateManager.isReady()) {
                return;
            }
            const now = Math.floor(Date.now() / 1000);
            NotiflyStorage.setItem(NotiflyStorageKeys.NOTIFLY_USER_STATE, JSON.stringify(WebMessageManager.state));
            NotiflyStorage.setItem(NotiflyStorageKeys.LAST_SESSION_TIME, now.toString());
        });
    }
}
