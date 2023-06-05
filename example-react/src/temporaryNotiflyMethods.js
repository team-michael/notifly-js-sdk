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

export function registerServiceWorker(VAPID_PUBLIC_KEY) {
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

          // TODO: Get the server's public key
          // const response = await fetch('./vapidPublicKey');
          // const vapidPublicKey = await response.text();
          // Chrome doesn't accept the base64-encoded (string) vapidPublicKey yet
          const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          return registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey,
          });
        });
    }).then(function (subscription) {
      console.log(JSON.stringify({
        subscription: subscription
      }));
      // TODO: Send the subscription details to the server.
      // Example:
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
}
