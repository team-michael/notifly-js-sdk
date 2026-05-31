import { SdkStateManager } from '../SdkState';
import { NotiflyStorage, NotiflyStorageKeys } from '../Storage';
import { UserStateManager, SyncStatePolicy } from '../User/State';
import { WebMessageManager } from '../WebMessages/Manager';
import { saveAndGetCognitoIdToken } from '../API/Auth';
import { SSEClient } from './SSEClient';
import { SSEController } from './SSEController';

const SSE_BASE_URL = 'https://api.notifly.tech';

interface ActiveController {
    controller: SSEController;
    projectId: string;
    notiflyUserId: string;
    deviceId: string | null;
}

export class SSEManager {
    private static active: ActiveController | null = null;
    private static observersRegistered = false;
    private static onVisibilityChange: (() => void) | null = null;
    private static onPageHide: ((event: PageTransitionEvent) => void) | null = null;
    private static onPageShow: ((event: PageTransitionEvent) => void) | null = null;
    private static initializing = false;

    static async start(): Promise<void> {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        this.registerObservers();
        if (document.visibilityState !== 'visible') return;
        await this.ensureController();
    }

    static stop(): void {
        if (!this.active) return;
        this.active.controller.stop();
    }

    static dispose(): void {
        if (this.active) {
            this.active.controller.stop();
            this.active = null;
        }
        this.unregisterObservers();
    }

    private static async ensureController(): Promise<void> {
        if (this.initializing) return;
        this.initializing = true;
        try {
            const [projectId, deviceId] = await NotiflyStorage.getItems([
                NotiflyStorageKeys.PROJECT_ID,
                NotiflyStorageKeys.NOTIFLY_DEVICE_ID,
            ]);
            if (!projectId || !deviceId) {
                this.stop();
                return;
            }

            let notiflyUserId: string;
            try {
                notiflyUserId = await NotiflyStorage.getNotiflyUserId();
            } catch {
                this.stop();
                return;
            }

            const current = this.active;
            if (
                current &&
                current.projectId === projectId &&
                current.notiflyUserId === notiflyUserId &&
                current.deviceId === deviceId
            ) {
                current.controller.start();
                return;
            }
            if (current) {
                current.controller.stop();
                this.active = null;
            }

            const client = new SSEClient({
                projectId,
                notiflyUserId,
                deviceId,
                baseUrl: SSE_BASE_URL,
                sdkVersionHeader: `notifly/js/${SdkStateManager.getSdkVersion()}`,
                tokenProvider: () => this.resolveToken(),
            });
            const controller = new SSEController({
                sseClient: client,
                onSyncRequested: (completion) => {
                    this.runSync(completion).catch(() => undefined);
                },
                onServerEventTriggered: (name, eventParams) => {
                    this.dispatchServerEvent(name, eventParams).catch(() => undefined);
                },
            });
            this.active = { controller, projectId, notiflyUserId, deviceId };
            controller.start();
        } catch (e) {
            console.warn('[Notifly] SSEManager.ensureController failed', e);
        } finally {
            this.initializing = false;
        }
    }

    private static async resolveToken(): Promise<string> {
        const cached = await NotiflyStorage.getItem(NotiflyStorageKeys.COGNITO_ID_TOKEN);
        if (cached) return cached;
        const [username, password] = await NotiflyStorage.getItems([
            NotiflyStorageKeys.USERNAME,
            NotiflyStorageKeys.PASSWORD,
        ]);
        if (!username || !password) throw new Error('SSE: credentials missing');
        const issued = await saveAndGetCognitoIdToken(username, password);
        if (!issued) throw new Error('SSE: token issue failed');
        return issued;
    }

    private static async runSync(completion: () => void): Promise<void> {
        try {
            await UserStateManager.refresh(SyncStatePolicy.OVERWRITE);
        } finally {
            completion();
        }
    }

    private static async dispatchServerEvent(name: string, eventParams: Record<string, unknown> | null): Promise<void> {
        const externalUserId = await NotiflyStorage.getItem(NotiflyStorageKeys.EXTERNAL_USER_ID);
        WebMessageManager.maybeTriggerWebMessagesAndUpdateEventCounts(
            name,
            (eventParams ?? {}) as Record<string, unknown>,
            externalUserId
        );
    }

    private static registerObservers(): void {
        if (this.observersRegistered) return;
        this.observersRegistered = true;
        const onVisibility = (): void => {
            if (document.visibilityState === 'visible') {
                this.ensureController().catch(() => undefined);
            } else {
                this.stop();
            }
        };
        const onHide = (event: PageTransitionEvent): void => {
            if (event.persisted) this.stop();
        };
        const onShow = (event: PageTransitionEvent): void => {
            if (event.persisted && document.visibilityState === 'visible') {
                this.ensureController().catch(() => undefined);
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('pagehide', onHide);
        window.addEventListener('pageshow', onShow);
        this.onVisibilityChange = onVisibility;
        this.onPageHide = onHide;
        this.onPageShow = onShow;
    }

    private static unregisterObservers(): void {
        if (!this.observersRegistered) return;
        if (this.onVisibilityChange) {
            document.removeEventListener('visibilitychange', this.onVisibilityChange);
        }
        if (this.onPageHide) {
            window.removeEventListener('pagehide', this.onPageHide);
        }
        if (this.onPageShow) {
            window.removeEventListener('pageshow', this.onPageShow);
        }
        this.onVisibilityChange = null;
        this.onPageHide = null;
        this.onPageShow = null;
        this.observersRegistered = false;
    }
}
