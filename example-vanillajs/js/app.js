const eventjs1button = document.getElementById('eventjs1');
const eventjs2button = document.getElementById('eventjs2');

eventjs1button.addEventListener('click', function () {
    window.notifly.trackEvent('eventjs1');
    console.log('eventjs1 clicked');
});

eventjs2button.addEventListener('click', function () {
    window.notifly.trackEvent('eventjs2');
    console.log('eventjs2 clicked');
});

const userIdInput = document.getElementById('userIdInput');
const userIdSaveButton = document.getElementById('userIdSave');

userIdSaveButton.addEventListener('click', function () {
    window.notifly.setUserId(userIdInput.value);
    console.log(`User Id set: ${userIdInput.value}`);
});
