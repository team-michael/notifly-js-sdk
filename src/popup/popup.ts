import * as localForage from 'localforage';
export function showPopup(): Promise<NotificationPermission> {
    return new Promise((resolve) => {
        setTimeout(() => {
            const overlay = document.createElement('div');
            const popup = document.createElement('div');
            const closeButton = document.createElement('button');
            const header = document.createElement('h2');
            const message = document.createElement('p');
            const buttonContainer = document.createElement('div');
            const grantButton = document.createElement('button');
            const denyButton = document.createElement('button');

            overlay.id = 'overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '10px';
            overlay.style.right = '10px';
            overlay.style.display = 'flex';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            overlay.style.zIndex = '9999';
            overlay.style.width = '350px';
            overlay.style.maxWidth = '50%';

            popup.id = 'popup';
            popup.style.position = 'relative';
            popup.style.paddingTop = '10px';
            popup.style.paddingRight = '20px';
            popup.style.paddingBottom = '20px';
            popup.style.paddingLeft = '20px';
            popup.style.backgroundColor = '#fff';
            popup.style.border = '1px solid #d3d3d3';
            popup.style.borderRadius = '8px';
            popup.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';

            closeButton.style.position = 'absolute';
            closeButton.style.right = '20px';
            closeButton.style.top = '10px';
            closeButton.style.border = 'none';
            closeButton.style.background = 'none';
            closeButton.style.cursor = 'pointer';
            closeButton.style.fontSize = '25px';
            closeButton.style.color = '#c6c6c6';
            closeButton.innerHTML = '&times;';

            header.style.marginTop = '10px';
            header.style.marginBottom = '5px';
            header.style.marginLeft = '0px';
            header.style.marginRight = '0px';
            message.style.marginTop = '5px';
            message.style.marginBottom = '10px';
            message.style.marginLeft = '0px';
            message.style.marginRight = '0px';
            header.style.fontWeight = '600';
            message.style.fontWeight = '400';

            buttonContainer.style.display = 'flex';
            buttonContainer.style.justifyContent = 'flex-end';
            buttonContainer.style.gap = '10px';

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

            header.style.fontSize = '16px';
            message.style.fontSize = '16px';
            grantButton.style.fontSize = '16px';
            denyButton.style.fontSize = '16px';

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

            overlay.appendChild(popup);
            buttonContainer.appendChild(grantButton);
            buttonContainer.appendChild(denyButton);
            popup.appendChild(closeButton);
            popup.appendChild(header);
            popup.appendChild(message);
            popup.appendChild(buttonContainer);

            document.body.appendChild(overlay);

            grantButton.onclick = async () => {
                document.body.removeChild(overlay);
                const permission = await Notification.requestPermission();
                resolve(permission);
            };

            denyButton.onclick = async () => {
                try {
                    await localForage.setItem('__notiflyNotificationPermission', 'denied');
                } catch (e) {
                    console.error('[Notifly] Failed to set notification permission to denied: ', e);
                }
                document.body.removeChild(overlay);
                resolve('default');
            };

            closeButton.onclick = async () => {
                try {
                    await localForage.setItem('__notiflyNotificationPermission', 'denied');
                } catch (e) {
                    console.error('[Notifly] Failed to set notification permission to denied: ', e);
                }
                document.body.removeChild(overlay);
                resolve('default');
            };
        }, 5000);
    });
}
