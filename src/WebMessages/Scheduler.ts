import type { Campaign } from '../Types';
import { setUserProperties } from '../User';
import { logEvent } from '../Event';

export class WebMessageScheduler {
    private static _isWebMessageOpen = false;

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

        let iframeContainer: HTMLDivElement;
        let iframe: HTMLIFrameElement;

        try {
            // Create iframe container and iframe
            iframeContainer = document.createElement('div');
            iframeContainer.id = `notifly-web-message-container-${new Date().toISOString()}`;

            iframe = document.createElement('iframe');
            iframe.id = `notifly-web-message-iframe-${new Date().toISOString()}`;
            iframe.src = message.html_url;

            // Override user agent stylesheet (css reset)
            iframeContainer.style.border = 'none';
            iframeContainer.style.overflow = 'hidden !important';
            iframeContainer.style.margin = '0';
            iframeContainer.style.padding = '0';
            iframeContainer.style.display = 'block';

            iframe.style.border = 'none';
            iframe.style.overflow = 'hidden !important';
            iframe.style.margin = '0';
            iframe.style.padding = '0';
            iframe.style.display = 'block';
            iframe.style.width = '100%';
            iframe.style.height = '100%';

            // Apply modal properties
            iframeContainer.style.width = _convertToValidCSSStyle(modalProperties.width, '100%');
            iframeContainer.style.height = _convertToValidCSSStyle(modalProperties.height, '100%');
            iframeContainer.style.zIndex = _convertToValidCSSStyle(modalProperties.zIndex, '9999');
            iframeContainer.style.position = _convertToValidCSSStyle(modalProperties.position, 'fixed');

            if (modalProperties.background) {
                iframeContainer.style.width = '100%';
                iframeContainer.style.height = '100%';
                iframeContainer.style.background = _convertToValidCSSStyle(
                    modalProperties.backgroundOpacity,
                    'rgba(0,0,0,0.2)'
                );
            } else {
                iframeContainer.style.background = 'transparent';
            }
            if (modalProperties.padding) {
                iframeContainer.style.padding = _convertToValidCSSStyle(modalProperties.padding, '0px');
            }
            if (iframeContainer.style.position === 'fixed') {
                // If top and bottom are both defined, bottom will take precedence
                if (modalProperties.center) {
                    iframeContainer.style.top = '50%';
                    iframeContainer.style.left = '50%';
                    iframeContainer.style.transform = 'translate(-50%, -50%)';
                } else {
                    if (modalProperties.right !== undefined) {
                        iframeContainer.style.right = _convertToValidCSSStyle(modalProperties.right, '0px');
                    } else if (modalProperties.left !== undefined) {
                        iframeContainer.style.left = _convertToValidCSSStyle(modalProperties.left, '0px');
                    } else {
                        iframeContainer.style.left = '0px';
                    }
                    if (modalProperties.bottom !== undefined) {
                        iframeContainer.style.bottom = _convertToValidCSSStyle(modalProperties.bottom);
                    } else if (modalProperties.top !== undefined) {
                        iframeContainer.style.top = _convertToValidCSSStyle(modalProperties.top);
                    } else {
                        iframeContainer.style.top = '0px';
                    }
                }
            }

            iframeContainer.appendChild(iframe);

            // Insert iframe container into DOM
            const firstChild = document.body.firstChild;
            document.body.insertBefore(iframeContainer, firstChild);

            logEvent(
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
                        if (event.source === iframe.contentWindow) {
                            const message = event.data;
                            if (message.type === 'close') {
                                this._isWebMessageOpen = false;
                                try {
                                    document.body.removeChild(iframeContainer);
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
                                await logEvent(
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
                                    document.body.removeChild(iframeContainer);
                                } catch (error) {
                                    /* empty */
                                } finally {
                                    window.removeEventListener('message', messageEventListener);
                                }
                                await logEvent(
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
        } catch (error) {
            this._isWebMessageOpen = false;
            console.error('[Notifly] Error creating iframe: ', error);
        }
    }

    static scheduleInWebMessage(campaign: Campaign) {
        const delayInSeconds = campaign.delay ?? 0;
        delayInSeconds === 0
            ? this._showInWebMessage(campaign)
            : setTimeout(() => {
                  try {
                      this._showInWebMessage(campaign);
                  } catch (error) {
                      console.error('[Notifly] Error showing web message: ', error);
                  }
              }, delayInSeconds * 1000);
    }
}

function _convertToValidCSSStyle(value: string | number | undefined, defaultValue = 'auto'): string {
    if (typeof value === 'number') {
        return `${value}px`;
    } else if (typeof value === 'string') {
        return value;
    } else {
        return defaultValue;
    }
}
