import type { Campaign } from '../Types';

import { setUserProperties } from '../User';
import { EventManager } from '../Event/Manager';
import { SdkStateManager, SdkStateObserver } from '../SdkState';
import { WebMessageRenderer } from './Renderer';

class SdkStateObserverForWebMessageScheduler implements SdkStateObserver {
    onInitialized() {
        // No-op
        return;
    }

    onRefreshCompleted() {
        // No-op
        return;
    }

    onRefreshStarted() {
        WebMessageScheduler.descheduleInWebMessage();
    }
}

export class WebMessageScheduler {
    private static _isWebMessageOpen = false;
    private static _scheduledWebMessages: {
        timerId: ReturnType<typeof setTimeout>;
        campaignId: string;
    }[] = [];

    static initialize() {
        SdkStateManager.registerObserver(new SdkStateObserverForWebMessageScheduler());
    }

    private static _showInWebMessage(campaign: Campaign) {
        if (this._isWebMessageOpen) {
            console.warn(
                `[Notifly] Web message is already open. Ignoring this message from campaign ${campaign.id}...`
            );
            return;
        }

        this._isWebMessageOpen = true;

        const message = campaign.message;
        const modalProperties = message.modal_properties;
        const templateName = modalProperties.template_name;

        try {
            const renderer = new WebMessageRenderer(campaign.message.modal_properties, message.html_url, () => {
                EventManager.logEvent(
                    'in_web_message_show',
                    {
                        type: 'message_event',
                        channel: 'in-web-message',
                        campaign_id: campaign.id,
                    },
                    null,
                    true
                );

                // Listen for messages from the iframe
                const messageEventListener = (() => {
                    const func = async (event: MessageEvent) => {
                        try {
                            if (event.source === renderer.iframe.contentWindow) {
                                const message = event.data;
                                if (message.type === 'close') {
                                    this._isWebMessageOpen = false;
                                    try {
                                        renderer.dispose();
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
                                                await setUserProperties({
                                                    [`hide_in_web_message_${templateName}`]: data.hideUntil,
                                                });
                                            }
                                        }
                                    }
                                    await EventManager.logEvent(
                                        'close_button_click',
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
                                        renderer.dispose();
                                    } catch (error) {
                                        /* empty */
                                    } finally {
                                        window.removeEventListener('message', messageEventListener);
                                    }
                                    await EventManager.logEvent(
                                        'main_button_click',
                                        {
                                            type: 'message_event',
                                            channel: 'in-web-message',
                                            button_name: message.buttonName,
                                            campaign_id: campaign.id,
                                        },
                                        null,
                                        true
                                    );
                                }
                                if (message.link) {
                                    // Navigate to link if necessary
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
            });

            renderer.render();
        } catch (error) {
            this._isWebMessageOpen = false;
            console.error('[Notifly] Error creating in web message: ', error);
        }
    }

    static scheduleInWebMessage(campaign: Campaign) {
        const delayInSeconds = campaign.delay ?? 0;

        if (delayInSeconds <= 0) {
            this._showInWebMessage(campaign);
        } else {
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

    static descheduleInWebMessage(campaignId: string | null = null) {
        if (!campaignId) {
            this._scheduledWebMessages.forEach((element) => clearTimeout(element.timerId));
            this._scheduledWebMessages = [];
        } else {
            const index = this._scheduledWebMessages.findIndex((item) => item.campaignId === campaignId);
            if (index !== -1) {
                clearTimeout(this._scheduledWebMessages[index].timerId);
                this._scheduledWebMessages.splice(index, 1);
            }
        }
    }
}
