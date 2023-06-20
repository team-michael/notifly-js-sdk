import type { Campaign } from './types';
import { setUserProperties } from './user';
import { logEvent } from './logEvent';

function showInWebMessage(campaign: Campaign) {
    const message = campaign.message;
    const modalProperties = message.modal_properties;
    const templateName = modalProperties.template_name;

    const iframe = document.createElement('iframe');
    iframe.src = message.html_url;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.zIndex = '10';
    iframe.style.position = 'fixed';

    const delayInSeconds = campaign.delay ?? 0;
    setTimeout(() => {
        document.body.appendChild(iframe);
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
    }, delayInSeconds * 1000);

    // Listen for messages from the iframe
    window.addEventListener('message', async function (event) {
        if (event.source === iframe.contentWindow) {
            const message = event.data;
            if (message.type === 'close') {
                document.body.removeChild(iframe);
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
    });
}

export { showInWebMessage };
