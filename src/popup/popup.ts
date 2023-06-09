import * as localForage from 'localforage';
export function showPopup(): Promise<NotificationPermission> {
    return new Promise((resolve) => {
        // Create the popup elements
        const popup = document.createElement('div');
        const header = document.createElement('h2');
        const message = document.createElement('p');
        const buttonContainer = document.createElement('div');
        const grantButton = document.createElement('button');
        const denyButton = document.createElement('button');

        // Set their properties
        popup.id = 'popup';
        popup.style.position = 'fixed';
        popup.style.top = '10px';
        popup.style.right = '10px';
        popup.style.paddingTop = '10px';
        popup.style.paddingRight = '20px';
        popup.style.paddingBottom = '20px';
        popup.style.paddingLeft = '20px';
        popup.style.backgroundColor = '#fff';
        popup.style.border = '1px solid #333';
        popup.style.borderRadius = '8px';
        popup.style.width = '300px';
        popup.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
        header.style.fontSize = '1em';  // Smaller font for the title
        header.style.marginBottom = '10px';

        // Button container styles for aligning buttons on the right
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.gap = '10px';

        // Button styles
        grantButton.style.padding = '5px 15px';
        grantButton.style.border = 'none';
        grantButton.style.backgroundColor = '#007bff';
        grantButton.style.color = 'white';
        grantButton.style.cursor = 'pointer';
        grantButton.style.borderRadius = '5px';

        denyButton.style.padding = '5px 15px';
        denyButton.style.border = 'none';
        denyButton.style.backgroundColor = '#808080';
        denyButton.style.color = 'white';
        denyButton.style.cursor = 'pointer';
        denyButton.style.borderRadius = '5px';

        const language = navigator.language;
        if (language.startsWith('ko')) {
            header.textContent = '\uD83D\uDD14 푸시 알림 받기';
            message.textContent = '푸시 알림을 허용하고 중요한 정보를 실시간으로 받아보세요! ';
            grantButton.textContent = '알림 받기';
            denyButton.textContent = '다음에';
        } else {
            header.textContent = '\uD83D\uDD14 Receive Push Notifications';
            message.textContent = 'Allow push notifications and receive important information in real-time!';
            grantButton.textContent = 'Receive Notifications';
            denyButton.textContent = 'Not Now';
        }

        // Append buttons to the buttonContainer
        buttonContainer.appendChild(grantButton);
        buttonContainer.appendChild(denyButton);

        // Append them to the popup
        popup.appendChild(header);
        popup.appendChild(message);
        popup.appendChild(buttonContainer);

        // Append the popup to the body
        document.body.appendChild(popup);

        // Attach event handlers to the buttons
        grantButton.onclick = async () => {
            document.body.removeChild(popup);
            const permission = await Notification.requestPermission();
            resolve(permission);
        };

        denyButton.onclick = async () => {
            try {
                await localForage.setItem('__notiflyNotificationPermission', 'denied');
            } catch (e) {
                console.error(e);
            }
            document.body.removeChild(popup);
            resolve('default');
        };
    });
}
