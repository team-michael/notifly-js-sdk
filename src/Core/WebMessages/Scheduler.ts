import type { Campaign } from '../Interfaces/Campaign';

import { render, close, getIframe, RendererCallbacks } from 'notifly-web-message-renderer';

import { UserIdentityManager } from '../User';
import { EventLogger, NotiflyInternalEvent } from '../Event';
import { SdkState, SdkStateManager, SdkStateObserver } from '../SdkState';
import { UserStateManager } from '../User/State';
import { NotiflyStorage, NotiflyStorageKeys } from '../Storage';
import { generateNotiflyUserId } from '../Utils';
import { KmpPopupRenderTask } from '../KmpCore';
import { renderPopup } from './Renderer';
import { BuiltInUserPropertyKey } from '../../Constants';
import { NotiflyWebPushManager } from '../Push';

interface ScheduledWebMessage {
    timerId?: ReturnType<typeof setTimeout>;
    campaignId: string;
    renderTask?: KmpPopupRenderTask;
}

const RENDER_IDENTITY_KEYS = [
    NotiflyStorageKeys.PROJECT_ID,
    NotiflyStorageKeys.EXTERNAL_USER_ID,
    NotiflyStorageKeys.NOTIFLY_DEVICE_ID,
];

class SdkStateObserverForWebMessageScheduler implements SdkStateObserver {
    onRefreshStarted() {
        WebMessageScheduler.descheduleInWebMessage(); // fixme: ultimately, we should re-evaluate campaign visibilities
    }

    onTerminated() {
        WebMessageScheduler.descheduleInWebMessage();
    }
}

export class WebMessageScheduler {
    private static _isWebMessageOpen = false;
    private static _scheduledWebMessages: ScheduledWebMessage[] = [];
    private static _renderingWebMessage: ScheduledWebMessage | null = null;
    private static _webMessageGeneration = 0;

    static initialize() {
        SdkStateManager.registerObserver(new SdkStateObserverForWebMessageScheduler());
    }

    private static _showInWebMessage(campaign: Campaign, renderedHtml?: string) {
        if (this._isWebMessageOpen || this._renderingWebMessage) {
            console.warn(
                `[Notifly] Web message is already open. Ignoring this message from campaign ${campaign.id}...`
            );
            return;
        }
        const campaignHiddenUntilData = campaign.re_eligible_condition
            ? UserStateManager.updateAndGetCampaignHiddenUntilDataAccordingToReEligibleCondition(
                  campaign.id,
                  campaign.re_eligible_condition
              )
            : null;

        const message = campaign.message;
        const modalProperties = message.modal_properties;
        const templateName = modalProperties.template_name;
        const popupExternalUserId = UserStateManager.userData.external_user_id ?? null;
        const popupGeneration = ++this._webMessageGeneration;
        let activeMessageListener: ((event: MessageEvent) => void) | undefined;
        const removeMessageListener = () => {
            if (activeMessageListener) window.removeEventListener('message', activeMessageListener);
        };

        const callbacks: RendererCallbacks = {
            onRenderCompleted: () => {
                EventLogger.logEvent(
                    NotiflyInternalEvent.IN_WEB_MESSAGE_SHOW,
                    {
                        type: 'message_event',
                        channel: 'in-web-message',
                        campaign_id: campaign.id,
                        template_name: templateName,
                        ...(campaignHiddenUntilData ? { hide_until_data: campaignHiddenUntilData } : {}),
                    },
                    null,
                    true
                );

                // Listen for messages from the iframe
                const messageEventListener = (() => {
                    let handlingWebPushConsent = false;
                    let consentedAt: string | undefined;
                    const func = async (event: MessageEvent) => {
                        try {
                            if (
                                popupGeneration === this._webMessageGeneration &&
                                event.source === getIframe().contentWindow
                            ) {
                                const message = event.data;
                                if (!message || typeof message !== 'object' || Array.isArray(message)) return;
                                if (message.type === '__notifly_web_message_loaded') {
                                    // A reused iframe may reload after onRenderCompleted has already fired.
                                    getIframe().contentWindow?.postMessage(
                                        { type: '__notifly_web_push_consent_ready' },
                                        '*'
                                    );
                                    return;
                                }
                                if (message.type === 'web_push_consent') {
                                    if (handlingWebPushConsent) return;
                                    const popupWindow = getIframe().contentWindow;
                                    const buttonName = typeof message.buttonName === 'string' ? message.buttonName : '';
                                    const respond = (status: string) =>
                                        popupWindow?.postMessage(
                                            { type: '__notifly_web_push_consent_result', status, buttonName },
                                            '*'
                                        );
                                    if ((UserStateManager.userData.external_user_id ?? null) !== popupExternalUserId) {
                                        respond('identity_changed');
                                        return;
                                    }
                                    if (SdkStateManager.state !== SdkState.READY) {
                                        respond('not_ready');
                                        return;
                                    }
                                    if (navigator.userActivation && !navigator.userActivation.isActive) {
                                        respond('interaction_required');
                                        return;
                                    }
                                    handlingWebPushConsent = true;
                                    try {
                                        consentedAt ??= new Date().toISOString();
                                        const saveConsent = UserIdentityManager.setUserPropertiesWithResult(
                                            {
                                                [BuiltInUserPropertyKey.WEB_PUSH_CONSENT]: true,
                                                [BuiltInUserPropertyKey.WEB_PUSH_CONSENTED_AT]: consentedAt,
                                            },
                                            popupExternalUserId
                                        );
                                        // Begin the browser request before any async work can expire user activation.
                                        const requestPermission = NotiflyWebPushManager.requestPermissionDirectly();
                                        void EventLogger.logEvent(
                                            NotiflyInternalEvent.MAIN_BUTTON_CLICK,
                                            {
                                                type: 'message_event',
                                                channel: 'in-web-message',
                                                button_name: buttonName,
                                                campaign_id: campaign.id,
                                            },
                                            null,
                                            true,
                                            { expectedExternalUserId: popupExternalUserId }
                                        );
                                        const [consentResult, permissionResult] = await Promise.all([
                                            saveConsent,
                                            requestPermission,
                                        ]);
                                        const isCurrentUser = await UserIdentityManager.isCurrentUser(
                                            popupExternalUserId
                                        );
                                        if (
                                            !this._isWebMessageOpen ||
                                            popupGeneration !== this._webMessageGeneration ||
                                            getIframe().contentWindow !== popupWindow
                                        )
                                            return;
                                        if (!isCurrentUser) {
                                            respond('identity_changed');
                                            return;
                                        }
                                        const status = consentResult === 'sent' ? permissionResult : consentResult;
                                        respond(status);
                                        if (status === 'granted') {
                                            this._isWebMessageOpen = false;
                                            close();
                                            window.removeEventListener('message', messageEventListener);
                                        }
                                    } catch (error) {
                                        if (
                                            popupGeneration === this._webMessageGeneration &&
                                            getIframe().contentWindow === popupWindow
                                        )
                                            respond('failed');
                                        console.error('[Notifly] Failed to save web push consent.', error);
                                    } finally {
                                        handlingWebPushConsent = false;
                                    }
                                    return;
                                }
                                // Open blank-mode links synchronously to preserve user activation (popups are blocked after await)
                                if (message.link && modalProperties?.link_open_mode === 'blank') {
                                    const a = document.createElement('a');
                                    document.body.appendChild(a);
                                    a.setAttribute('style', 'display: none');
                                    a.href = message.link;
                                    a.target = '_blank';
                                    a.rel = 'noopener noreferrer';
                                    a.click();
                                    document.body.removeChild(a);
                                }
                                if (message.type === 'close') {
                                    this._isWebMessageOpen = false;
                                    try {
                                        close();
                                    } catch (error) {
                                        /* empty */
                                    } finally {
                                        window.removeEventListener('message', messageEventListener);
                                    }
                                    const extraData = message.extraData;
                                    if (extraData) {
                                        const data = extraData.data;
                                        if (data) {
                                            if (data.hideUntil) {
                                                await UserIdentityManager.setUserProperties({
                                                    [`${NotiflyInternalEvent.HIDE_IN_WEB_MESSAGE}_${templateName}`]:
                                                        data.hideUntil,
                                                });
                                            }
                                        }
                                    }
                                    await EventLogger.logEvent(
                                        NotiflyInternalEvent.CLOSE_BUTTON_CLICK,
                                        {
                                            type: 'message_event',
                                            channel: 'in-web-message',
                                            button_name: message.buttonName,
                                            campaign_id: campaign.id,
                                        },
                                        null,
                                        true
                                    );
                                } else if (message.type === 'main_button') {
                                    this._isWebMessageOpen = false;
                                    try {
                                        close();
                                    } catch (error) {
                                        /* empty */
                                    } finally {
                                        window.removeEventListener('message', messageEventListener);
                                    }
                                    await EventLogger.logEvent(
                                        NotiflyInternalEvent.MAIN_BUTTON_CLICK,
                                        {
                                            type: 'message_event',
                                            channel: 'in-web-message',
                                            button_name: message.buttonName,
                                            campaign_id: campaign.id,
                                        },
                                        null,
                                        true
                                    );
                                } else {
                                    // No-op
                                    if (SdkStateManager.allowUserSuppliedLogEvent && message.type) {
                                        const { type, ...otherEventParams } = message;
                                        const isInternalEvent = Object.values(NotiflyInternalEvent).includes(type);
                                        EventLogger.logEvent(type, otherEventParams, null, isInternalEvent);
                                    }
                                }
                                // Navigate same-tab links after async work completes
                                if (message.link && modalProperties?.link_open_mode !== 'blank') {
                                    const a = document.createElement('a');
                                    document.body.appendChild(a);
                                    a.setAttribute('style', 'display: none');
                                    a.href = message.link;
                                    a.click();
                                    document.body.removeChild(a);
                                }
                            }
                        } catch (error) {
                            console.error('[Notifly] Error handling message from iframe: ', error);
                        }
                    };

                    return func.bind(this);
                })();

                window.addEventListener('message', messageEventListener);
                activeMessageListener = messageEventListener;
                getIframe().contentWindow?.postMessage({ type: '__notifly_web_push_consent_ready' }, '*');
            },
            onRenderFailed: () => {
                removeMessageListener();
                this._isWebMessageOpen = false;
                console.error(
                    '[Notifly] Error creating in web message. Web message content is either invalid or not found'
                );
            },
            onAutoDismissed: () => {
                removeMessageListener();
                this._isWebMessageOpen = false;
            },
        };
        this._isWebMessageOpen = true;
        try {
            if (renderedHtml === undefined) {
                render(modalProperties, message.html_url, callbacks);
            } else {
                render(modalProperties, renderedHtml, callbacks, { htmlBaseUrl: message.html_url });
            }
        } catch (error) {
            this._isWebMessageOpen = false;
            throw error;
        }
    }

    static scheduleInWebMessage(
        campaign: Campaign,
        eventName: string | null = null,
        eventParams: Record<string, unknown> = {},
        externalUserId: string | null = UserStateManager.userData.external_user_id ?? null
    ) {
        const delayInSeconds = campaign.delay ?? 0;
        if (campaign.message.template_rendering_mode === 'ssr') {
            this.descheduleInWebMessage(campaign.id);
            const scheduled: ScheduledWebMessage = { campaignId: campaign.id };
            this._scheduledWebMessages.push(scheduled);
            const start = () => {
                void this._renderInWebMessage(campaign, scheduled, eventName, eventParams, externalUserId);
            };
            if (delayInSeconds > 0) scheduled.timerId = setTimeout(start, delayInSeconds * 1000);
            else start();
            return;
        }

        if (delayInSeconds <= 0) {
            this._showInWebMessage(campaign);
        } else {
            // delay 윈도우 동안 hide_until 이 아직 비어있어 동일 캠페인이 중복 큐잉되는 것을 막는다.
            // iOS/Android SDK 와 동일하게 기존 타이머를 cancel-and-replace 한다.
            this.descheduleInWebMessage(campaign.id);

            const timerId = setTimeout(() => {
                try {
                    this._showInWebMessage(campaign);
                } catch (error) {
                    console.error('[Notifly] Error showing web message: ', error);
                } finally {
                    const index = this._scheduledWebMessages.findIndex((item) => item.timerId === timerId);
                    if (index !== -1) {
                        this._scheduledWebMessages.splice(index, 1);
                    }
                }
            }, delayInSeconds * 1000);

            this._scheduledWebMessages.push({
                timerId: timerId,
                campaignId: campaign.id,
            });
        }
    }

    static getScheduledCampaignIds(): string[] {
        return this._scheduledWebMessages.map((item) => item.campaignId);
    }

    static descheduleInWebMessage(campaignId: string | null = null) {
        const cancelled = this._scheduledWebMessages.filter((item) => !campaignId || item.campaignId === campaignId);
        this._scheduledWebMessages = this._scheduledWebMessages.filter((item) => !cancelled.includes(item));
        for (const item of cancelled) {
            clearTimeout(item.timerId);
            if (this._renderingWebMessage === item) {
                this._renderingWebMessage = null;
            }
            item.renderTask?.cancel();
        }
    }

    /** Keeps one display slot reserved while KMP prepares the popup for the triggering user. */
    private static async _renderInWebMessage(
        campaign: Campaign,
        scheduled: ScheduledWebMessage,
        eventName: string | null,
        eventParams: Record<string, unknown>,
        externalUserId: string | null
    ) {
        if (
            this._isWebMessageOpen ||
            this._renderingWebMessage ||
            SdkStateManager.halted ||
            SdkStateManager.state === SdkState.REFRESHING
        ) {
            this._finishRendering(scheduled);
            return;
        }
        this._renderingWebMessage = scheduled;
        try {
            const identity = await NotiflyStorage.getItems(RENDER_IDENTITY_KEYS);
            const [projectId, currentUserId, deviceId] = identity;
            if (!this._isCurrentRendering(scheduled) || !projectId || !deviceId || currentUserId !== externalUserId) {
                this._finishRendering(scheduled);
                return;
            }
            scheduled.renderTask = renderPopup(
                {
                    projectId,
                    deviceId,
                    notiflyUserId: generateNotiflyUserId(projectId, currentUserId, deviceId),
                    campaignId: campaign.id,
                    eventName,
                    eventParams,
                },
                (html) => {
                    void this._showRenderedWebMessage(campaign, scheduled, html, identity);
                }
            );
        } catch {
            this._finishRendering(scheduled);
            console.warn('[Notifly] Could not prepare popup rendering');
        }
    }

    /** Rechecks identity after the network request before handing HTML to the iframe renderer. */
    private static async _showRenderedWebMessage(
        campaign: Campaign,
        scheduled: ScheduledWebMessage,
        html: string | null,
        identity: Array<string | null>
    ) {
        try {
            if (!html || !this._isCurrentRendering(scheduled)) {
                this._finishRendering(scheduled);
                return;
            }
            const currentIdentity = await NotiflyStorage.getItems(RENDER_IDENTITY_KEYS);
            if (
                !this._isCurrentRendering(scheduled) ||
                !identity.every((value, index) => value === currentIdentity[index])
            ) {
                this._finishRendering(scheduled);
                return;
            }
            this._finishRendering(scheduled);
            this._showInWebMessage(campaign, html);
        } catch {
            this._finishRendering(scheduled);
            console.warn('[Notifly] Could not display rendered popup');
        }
    }

    private static _isCurrentRendering(scheduled: ScheduledWebMessage): boolean {
        return (
            this._renderingWebMessage === scheduled &&
            this._scheduledWebMessages.includes(scheduled) &&
            !SdkStateManager.halted &&
            SdkStateManager.state !== SdkState.REFRESHING
        );
    }

    private static _finishRendering(scheduled: ScheduledWebMessage) {
        this._scheduledWebMessages = this._scheduledWebMessages.filter((item) => item !== scheduled);
        if (this._renderingWebMessage === scheduled) this._renderingWebMessage = null;
    }
}
