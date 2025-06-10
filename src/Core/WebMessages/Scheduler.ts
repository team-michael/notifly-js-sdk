import type { Campaign } from '../Interfaces/Campaign';

import { render, close, getIframe } from 'notifly-web-message-renderer';

import { UserIdentityManager } from '../User';
import { EventLogger, NotiflyInternalEvent } from '../Event';
import { SdkStateManager, SdkStateObserver } from '../SdkState';
import { UserStateManager } from '../User/State';

class SdkStateObserverForWebMessageScheduler implements SdkStateObserver {
    onRefreshStarted() {
        WebMessageScheduler.descheduleInWebMessage(); // fixme: ultimately, we should re-evaluate campaign visibilities
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

        const campaignHiddenUntilData = campaign.re_eligible_condition
            ? UserStateManager.updateAndGetCampaignHiddenUntilDataAccordingToReEligibleCondition(
                  campaign.id,
                  campaign.re_eligible_condition
              )
            : null;

        const message = campaign.message;
        const modalProperties = message.modal_properties;
        const templateName = modalProperties.template_name;

        render(campaign.message.modal_properties, message.html_url, {
            onRenderCompleted: () => {
                EventLogger.logEvent(
                    NotiflyInternalEvent.IN_WEB_MESSAGE_SHOW,
                    {
                        type: 'message_event',
                        channel: 'in-web-message',
                        campaign_id: campaign.id,
                        ...(campaignHiddenUntilData ? { hide_until_data: campaignHiddenUntilData } : {}),
                    },
                    null,
                    true
                );

                // Listen for messages from the iframe
                const messageEventListener = (() => {
                    const func = async (event: MessageEvent) => {
                        try {
                            if (event.source === getIframe().contentWindow) {
                                const message = event.data;
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
            },
            onRenderFailed: () => {
                this._isWebMessageOpen = false;
                console.error(
                    '[Notifly] Error creating in web message. Web message content is either invalid or not found'
                );
            },
            onAutoDismissed: () => {
                this._isWebMessageOpen = false;
            },
        });
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
