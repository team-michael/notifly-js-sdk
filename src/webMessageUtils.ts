import { Campaign } from './interface/campaign.interface';

function showInWebMessage(campaign: Campaign) {
    const iframe = document.createElement('iframe');
    iframe.src = campaign.message.html_url;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.zIndex = '10';
    iframe.style.position = 'absolute';

    const delayInSeconds = campaign.delay ?? 0;
    setTimeout(() => {
        document.body.appendChild(iframe);
    }, delayInSeconds * 1000);

    // Listen for messages from the iframe
    window.addEventListener('message', function (event) {
        if (event.source === iframe.contentWindow) {
            const message = event.data;
            console.log('Received message from iframe:', message);

            if (message.type === 'close') {
                document.body.removeChild(iframe);
            }
        }
    });
}

export { showInWebMessage };
