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

export async function registerServiceWorker(VAPID_PUBLIC_KEY) {
  const registration = await navigator.serviceWorker.register('/test-NotiflySDKWorker.js');
  const subscription = await getSubscription(registration, VAPID_PUBLIC_KEY);
  await logSubscription(subscription);
}

async function getSubscription(registration, VAPID_PUBLIC_KEY) {
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    return subscription;
  }

  // Chrome doesn't accept the base64-encoded (string) vapidPublicKey yet
  const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedVapidKey,
  });
}

async function logSubscription(subscription) {
  console.log(JSON.stringify({ subscription: subscription }));
  // TODO: Send the subscription details to the server.
  // Example:
  /* 
  await fetch('./register', {
    method: 'post',
    headers: {
      'Content-type': 'application/json'
    },
    body: JSON.stringify({ subscription }),
  });
  */
}
