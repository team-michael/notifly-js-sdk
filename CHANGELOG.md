# 2.10.0

-   Now advanced triggering condition is available for in-web messages
    -   `triggering_event` field has been deprecated, use `triggering_conditions` instead
    -   `last_updated_timestamp` field has been deprecated, use `updated_at` instead
-   API request header now contains `X-Notifly-SDK-Version` to identify SDK version
    -   Format: `Notifly/${SDK_TYPE}/${SDK_VERSION}` (e.g. `Notifly/js/2.10.0`)
-   Add `setUserAttribute` method to set user attributes

# 2.9.4

-   Fix unhandled exception when browser terminates unexpectedly

# 2.9.0 - 2.9.3

-   DO NOT USE THESE VERSIONS

# 2.8.4

-   Remove IndexedDB versioning to prevent bugs when browser has higher version of IndexedDB

# 2.8.3

-   Fix storage hanging indefinitely when browser shuts down unexpectedly for mobile Safari

# 2.8.2

-   Fix storage hanging indefinitely when browser shuts down unexpectedly

# 2.8.1

-   Fix bug when application is running in multiple tabs
-   Fix bug when user is switched from guest to registered user
-   Add project ID validation to prevent invalid project ID

# 2.8.0

-   Support more languages for web push notification permission request popup
    -   ko (Korean)
    -   en (English)
    -   ja (Japanese)
    -   zh (Chinese)
-   Support default language for web push notification permission request popup

# 2.7.8

-   Fix campaign message being displayed even when campaign is either expired or not in active state

# 2.7.6

-   Fix unexpected behavior when session has been expired

# 2.7.5

-   Add setSdkVersion method to set sdk version
-   Change requestPermisson method name to requestPermission

# 2.7.3

-   Add `js-flutter` sdk type

# 2.7.1

-   Support `random_bucket_number` segmentation

# 2.7.0

-   Add `requestPermisson` method to manually trigger web push notification permission request popup
-   Support customization of web push notification permission request popup design

# 2.6.1

-   Change updating policy: user states are saved when window is hidden

# 2.6.0

-   Improve stability of user state management
-   Implement triggering event filters for in web messages
