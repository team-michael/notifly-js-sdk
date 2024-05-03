const userIdInput = document.getElementById('userIdInput');
const userIdSaveButton = document.getElementById('userIdSave');

const eventNameInput = document.getElementById('event_name_input');
const trackEventButton = document.getElementById('track_event_button');

userIdSaveButton.addEventListener('click', function () {
    window.notifly.setUserId(userIdInput.value);
    console.log(`User Id set: ${userIdInput.value}`);
});

trackEventButton.addEventListener('click', function () {
    const eventName = eventNameInput.value.trim();
    if (!eventName) {
        alert('Event name is required');
        return;
    }
    window.notifly.trackEvent(eventName, {});
});
