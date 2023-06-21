import type { Campaign } from './types';
import { setUserProperties } from './user';
import { logEvent } from './logEvent';

let isWebMessageOpen = false;

function _convertToValidCSSStyle(value: string | number | undefined): string | undefined {
    if (typeof value === 'number') {
        return `${value}px`;
    } else {
        return value;
    }
}

function showInWebMessage(campaign: Campaign) {
    if (isWebMessageOpen) {
        console.log('[Notifly] Web message is already open');
        return;
    }
    const message = campaign.message;
    const modalProperties = message.modal_properties;
    const templateName = modalProperties.template_name;

    let iframe: HTMLIFrameElement;
    try {
        iframe = document.createElement('iframe');
        iframe.src = message.html_url;
        iframe.style.width = _convertToValidCSSStyle(modalProperties.width) ?? '100%';
        iframe.style.height = _convertToValidCSSStyle(modalProperties.height) ?? '100%';
        iframe.style.zIndex = _convertToValidCSSStyle(modalProperties.zIndex) ?? '900';
        iframe.style.position = _convertToValidCSSStyle(modalProperties.position) ?? 'fixed';
        if (modalProperties.bottom !== undefined) {
            iframe.style.bottom = _convertToValidCSSStyle(modalProperties.bottom) ?? '0';
        }

        // Override user agent stylesheet (css reset)
        iframe.style.border = 'none';
        iframe.style.overflow = 'hidden !important';
        iframe.style.margin = '0';
        iframe.style.padding = '0';
        iframe.style.display = 'block';
    } catch (error) {
        console.error('[Notifly] Error creating iframe: ', error);
    }

    const delayInSeconds = campaign.delay ?? 0;
    setTimeout(() => {
        try {
            isWebMessageOpen = true;
            const firstChild = document.body.firstChild;
            document.body.insertBefore(iframe, firstChild);
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

    // Listen for messages from the iframe
    window.addEventListener('message', async function (event) {
        try {
            if (event.source === iframe.contentWindow) {
                const message = event.data;
                if (message.type === 'close') {
                    isWebMessageOpen = false;
                    try {
                        document.body.removeChild(iframe);
                    } catch (error) {
                        /* empty */
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
}

export { showInWebMessage };
