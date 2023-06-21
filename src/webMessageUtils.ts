import type { Campaign } from './types';
import { setUserProperties } from './user';
import { logEvent } from './logEvent';

let isWebMessageOpen = false;

function _convertToValidCSSStyle(value: string | number | undefined, defaultValue = 'auto'): string {
    if (typeof value === 'number') {
        return `${value}px`;
    } else if (typeof value === 'string') {
        return value;
    } else {
        return defaultValue;
    }
}

function _registerMessageEventListenerOnce(task: (e: MessageEvent) => void) {
    const taskWrapper = (function () {
        const internalTaskFunction = function (e: MessageEvent) {
            const destroyEventListener = function () {
                window.removeEventListener('message', taskWrapper);
            };
            destroyEventListener();
            task(e);
        };
        return internalTaskFunction;
    })();

    window.addEventListener('message', taskWrapper);
}

function showInWebMessage(campaign: Campaign) {
    if (isWebMessageOpen) {
        console.log('[Notifly] Web message is already open');
        return;
    }
    const message = campaign.message;
    const modalProperties = message.modal_properties;
    const templateName = modalProperties.template_name;

    let iframeContainer: HTMLDivElement;
    let iframe: HTMLIFrameElement;
    try {
        iframeContainer = document.createElement('div');
        iframeContainer.id = `notifly-web-message-container-${new Date().toISOString()}`;

        // Override user agent stylesheet (css reset)
        iframeContainer.style.border = 'none';
        iframeContainer.style.overflow = 'hidden !important';
        iframeContainer.style.margin = '0';
        iframeContainer.style.padding = '0';
        iframeContainer.style.display = 'block';

        iframeContainer.style.width = _convertToValidCSSStyle(modalProperties.width, '100%');
        iframeContainer.style.height = _convertToValidCSSStyle(modalProperties.height, '100%');
        iframeContainer.style.zIndex = _convertToValidCSSStyle(modalProperties.zIndex, '9999');
        iframeContainer.style.position = _convertToValidCSSStyle(modalProperties.position, 'fixed');

        // If top and bottom are both defined, bottom will take precedence
        if (iframeContainer.style.position === 'fixed') {
            iframeContainer.style.left = '0px';
            if (modalProperties.bottom !== undefined) {
                iframeContainer.style.bottom = _convertToValidCSSStyle(modalProperties.bottom);
            } else if (modalProperties.top !== undefined) {
                iframeContainer.style.top = _convertToValidCSSStyle(modalProperties.top);
            } else {
                iframeContainer.style.top = '0px';
            }
        }

        iframe = document.createElement('iframe');
        iframe.id = `notifly-web-message-iframe-${new Date().toISOString()}`;
        iframe.src = message.html_url;

        // Override user agent stylesheet (css reset)
        iframe.style.border = 'none';
        iframe.style.overflow = 'hidden !important';
        iframe.style.margin = '0';
        iframe.style.padding = '0';
        iframe.style.display = 'block';

        iframe.style.width = '100%';
        iframe.style.height = '100%';

        iframeContainer.appendChild(iframe);
    } catch (error) {
        console.error('[Notifly] Error creating iframe: ', error);
    }

    const delayInSeconds = campaign.delay ?? 0;
    setTimeout(() => {
        try {
            if (isWebMessageOpen) return;

            isWebMessageOpen = true;
            const firstChild = document.body.firstChild;
            document.body.insertBefore(iframeContainer, firstChild);

            // Listen for messages from the iframe
            _registerMessageEventListenerOnce(function (event) {
                try {
                    if (event.source === iframe.contentWindow) {
                        const message = event.data;
                        if (message.type === 'close') {
                            isWebMessageOpen = false;
                            try {
                                document.body.removeChild(iframeContainer);
                            } catch (error) {
                                /* empty */
                            }
                            const extraData = message.extraData;
                            if (extraData) {
                                const data = extraData.data;
                                if (data) {
                                    if (data.hideUntil) {
                                        setUserProperties({
                                            [`hide_in_web_message_${templateName}`]: data.hideUntil,
                                        });
                                    }
                                }
                            }
                            logEvent(
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
                            isWebMessageOpen = false;
                            try {
                                document.body.removeChild(iframeContainer);
                            } catch (error) {
                                /* empty */
                            }
                            logEvent(
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
                            window.open(message.link, '_blank');
                        }
                    }
                } catch (error) {
                    console.error('[Notifly] Error handling message from iframe: ', error);
                }
            });

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
        } catch (error) {
            console.error('[Notifly] Error showing web message: ', error);
        }
    }, delayInSeconds * 1000);
}

export { showInWebMessage };
