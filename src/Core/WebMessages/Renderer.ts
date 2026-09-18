import { KmpPopupFactory, KmpPopupRendererConfig, createKmpPopupRenderInput } from '../KmpCore';
import { SdkStateManager } from '../SdkState';

export interface PopupRenderContext {
    projectId: string;
    notiflyUserId: string;
    deviceId: string;
    campaignId: string;
    eventName: string | null;
    eventParams: Record<string, unknown>;
}

/** Delegates rendering to KMP while leaving scheduling and presentation in the JS SDK. */
export function renderPopup(
    context: PopupRenderContext,
    onComplete: (html: string | null) => void,
    baseUrl = 'https://render.notifly.tech'
) {
    const renderer = KmpPopupFactory.create(
        new KmpPopupRendererConfig(context.projectId, baseUrl, `notifly/js/${SdkStateManager.getSdkVersion()}`)
    );
    const input = createKmpPopupRenderInput(
        'ssr',
        context.campaignId,
        context.notiflyUserId,
        context.deviceId,
        context.eventName,
        context.eventParams
    );
    return renderer.render(input, (output) => {
        if (output.outcome === 'failed') {
            console.warn(`[Notifly] Popup rendering failed: ${output.errorCode}`);
        }
        onComplete(output.outcome === 'rendered' ? output.html ?? null : null);
    });
}
