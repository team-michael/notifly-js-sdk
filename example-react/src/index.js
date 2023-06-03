import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Register a Service Worker.
navigator.serviceWorker.register('/test-NotiflySDKWorker.js');

navigator.serviceWorker.ready
  .then(function (registration) {
    // Use the PushManager to get the user's subscription to the push service.
    return registration.pushManager.getSubscription()
      .then(async function (subscription) {
        // If a subscription was found, return it.
        if (subscription) {
          return subscription;
        }
        /* if(subscription) {
          // If a subscription was found, unsubscribe
          subscription.unsubscribe();
        } */

        // Get the server's public key
        // const response = await fetch('./vapidPublicKey');
        // const vapidPublicKey = await response.text();
        // Chrome doesn't accept the base64-encoded (string) vapidPublicKey yet
        const VAPID_PUBLIC_KEY="BGkEcbk7nbeozYYvs7EXqWDuqcDPBdxJ5p51jM9vx2ERj5iGSntBXFhIociva1boO9LuCec-ZCCAI_HC82NUIuQ"
        const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

        // Otherwise, subscribe the user (userVisibleOnly allows to specify that we don't plan to
        // send notifications that don't have a visible effect for the user).
        return registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      });
  }).then(function (subscription) {
    console.log(JSON.stringify({
      subscription: subscription
    }));
    // Send the subscription details to the server using the Fetch API.
    /* fetch('./register', {
      method: 'post',
      headers: {
        'Content-type': 'application/json'
      },
      body: JSON.stringify({
        subscription: subscription
      }),
    }); */
  });

function urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  var rawData = window.atob(base64);
  var outputArray = new Uint8Array(rawData.length);

  for (var i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
