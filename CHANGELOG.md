# Changelog

## [2.17.4]

### Added

-   Add `templateName` event param to `in_web_message_show` event

## [2.17.3]

### Changed

-   Only send diffs when the sdk type is Cafe24 JS

## [2.17.2]

### Added

-   Add `isInternalEvent` flag to `logEvent` method

## [2.17.1]

### Fixed

-   Fix bug when `allowUserSuppliedLogEvent` is set to `true`

## [2.17.0]

### Added

-   Add `allowUserSuppliedLogEvent` option to allow user to supply log event

## [2.16.0]

### Changed

-   Ensure userAttribute comparisons with null or undefined return false to prevent exceptions.

## [2.15.1]

### Changed

-   Update notifly-web-message-renderer version (v2.3.0)
    -   fix darkmode web popup issue

## [2.13.0]

### Changed

-   Change API hostname for tracking events
-   Remove redundant set user ID API calls

## [2.12.1]

### Fixed

-   Fix external user ID-based segmentation issue
-   **Note:** `2.11.x` versions have a critical bug that causes external user ID-based segmentation to not work properly. Please update to `2.12.1` to fix this issue.

## [2.12.0]

### Added

-   SDK now supports in-web-message template v3
    -   Animation effect is available
    -   Auto dismiss feature is available

## [2.10.4]

### Changed

-   Increase timestamp precision to microseconds

## [2.10.3]

### Changed

-   Listens to `DOMContentLoaded` event only when `document.readyState` is `loading`

## [2.10.2]

### Added

-   Add `onlyIfChanged` option to `setUserId` and `removeUserId` methods

## [2.10.1]

### Improved

-   Make user profile management more robust

## [2.10.0]

### Added

-   Advanced triggering condition is available for in-web messages
    -   `triggering_event` field has been deprecated, use `triggering_conditions` instead
    -   `last_updated_timestamp` field has been deprecated, use `updated_at` instead
-   API request header now contains `X-Notifly-SDK-Version` to identify SDK version
    -   Format: `Notifly/${SDK_TYPE}/${SDK_VERSION}` (e.g., `Notifly/js/2.10.0`)

## [2.9.4]

### Fixed

-   Fix unhandled exception when browser terminates unexpectedly

## [2.9.0 - 2.9.3]

### Warning

-   **DO NOT USE THESE VERSIONS**

## [2.8.4]

### Changed

-   Remove IndexedDB versioning to prevent bugs when browser has a higher version of IndexedDB

## [2.8.3]

### Fixed

-   Fix storage hanging indefinitely when the browser shuts down unexpectedly for mobile Safari

## [2.8.2]

### Fixed

-   Fix storage hanging indefinitely when the browser shuts down unexpectedly

## [2.8.1]

### Fixed

-   Fix bug when the application is running in multiple tabs
-   Fix bug when the user is switched from guest to registered user
-   Add project ID validation to prevent invalid project IDs

## [2.8.0]

### Added

-   Support more languages for web push notification permission request popup
    -   `ko` (Korean)
    -   `en` (English)
    -   `ja` (Japanese)
    -   `zh` (Chinese)
-   Support default language for web push notification permission request popup

## [2.7.8]

### Fixed

-   Fix campaign message being displayed even when the campaign is either expired or not in an active state

## [2.7.6]

### Fixed

-   Fix unexpected behavior when session has been expired

## [2.7.5]

### Added

-   Add `setSdkVersion` method to set SDK version
-   Change `requestPermisson` method name to `requestPermission`

## [2.7.3]

### Added

-   Add `js-flutter` SDK type

## [2.7.1]

### Added

-   Support `random_bucket_number` segmentation

## [2.7.0]

### Added

-   Add `requestPermisson` method to manually trigger web push notification permission request popup
-   Support customization of web push notification permission request popup design

## [2.6.1]

### Changed

-   Change updating policy: user states are saved when the window is hidden

## [2.6.0]

### Improved

-   Improve stability of user state management
-   Implement triggering event filters for in-web messages
