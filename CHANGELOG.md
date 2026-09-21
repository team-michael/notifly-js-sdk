# Changelog

## [2.21.0]

### Added

-   Integrate KMP Core 0.1.0 to display server-rendered web popups with Liquid personalization, catalogs, Connected Content, and render-abort handling.
-   Read `message.template_rendering_mode`; request rendered HTML only for `ssr`, while preserving the existing URL-based path for static, missing, or unrecognized modes.
-   Pass the triggering event name and nested event parameters together with the campaign, user, and device IDs to the rendering service after the campaign delay.
-   Supply rendered HTML to the iframe renderer with the original template URL as its base URL, preserving relative resources and existing click, close, and display-event behavior.
-   Track and cancel pending render requests when campaigns are cancelled or replaced, SDK refresh starts, or the SDK terminates. Recheck project, user, and device identity before displaying a result; skip aborted/failed renders without loading raw templates or consuming campaign re-eligibility.
-   Reserve the popup display slot while rendering so a later static popup cannot overtake the selected SSR popup; ignore late results from replaced requests and release the slot when rendering finishes.
-   Expose shared Core as a separate `notifly-core-sdk` npm package, versioned together with the full SDK.
-   Add Core smoke tests and popup regression coverage for delays, event context, cancellation, replacement, refresh, identity changes, display ordering, failures, and the initial session-start popup.

### Changed

-   Use shared Core decisions to detect user ID changes while preserving anonymous ID normalization.
-   Skip `setUserProperties` calls whose supplied keys and values match available local state within five seconds of the last property send attempt. First calls, changed values, and calls at or after five seconds use the normal path; skipped calls do not extend the window, and identity changes reset it. This comparison uses local state rather than server acknowledgement; Cafe24 retains its existing changed-properties-only behavior.
-   Upgrade `notifly-web-message-renderer` from `^2.4.0` to `^2.5.0` for rendered-HTML and base-URL support.
-   Build the pinned KMP submodule into a local npm workspace before dependency installation, and validate that Core and full-SDK versions match. Include distributable builds in CI and exclude Core source/build directories from the full-SDK npm package.
-   Publish Core before the full SDK with an exact matching dependency, validating package integrity when a version is already published.
-   Validate release versions, use separate `latest`, `alpha`, and `snapshot` npm channels, mark GitHub prereleases, and deploy the production Service Worker only for stable releases.
-   Promote the SDK and its exactly matching `notifly-core-sdk` dependency to stable `2.21.0`.

## [2.21.0-alpha.1]

### Added

-   Expose shared KMP Core as a separate `notifly-core-sdk` npm package, versioned together with the JS SDK.

### Changed

-   Use the shared Core policy to detect user ID changes while preserving anonymous user ID normalization.
-   Publish Core alongside the full SDK with an exact matching version dependency.
-   Publish alpha versions under the npm `alpha` tag and skip production Service Worker deployment for prereleases.

## [2.20.0]

### Fixed

-   Include a successfully uploaded local event in in-web message event-count segment evaluation
    -   Update local event counts before evaluating `count X` and `count X in Y days` conditions for local events
    -   Preserve the existing evaluation order for server-triggered SSE events, and do not update counts or evaluate messages when an upload fails

## [2.19.0]

### Added

-   **Real-time campaign data sync over SSE**
    -   Open a long-lived SSE channel from the SDK to Notifly server. When campaign state changes server-side (e.g. a new in-web message is triggered or a popup is updated), the SDK refreshes its local campaign data immediately instead of waiting for the next event-driven fetch.
    -   On reconnect, the SDK sends `Last-Event-ID` so the server can replay popup entries that were missed during the disconnect window, recovering messages that fired while offline.
    -   If the SSE channel cannot reach OPEN state within the fallback threshold, the SDK falls back to the legacy event-driven sync path automatically.

### Changed

-   Reconnect backoff uses full jitter (100ms ~ 10s) across all attempts to disperse reconnect bursts after server-side disconnects such as rolling deploys.
-   Reduce SSE verbose logging. Keep: `connected`, `disconnected`, `sync received` + error logs.

## [2.18.1]

### Fixed

-   Prevent duplicate timer queuing for the same in-web message campaign within the delay window
    -   When the same trigger event fires multiple times before the scheduled timer fires, only the latest timer is kept (cancel-and-replace)
    -   Aligns behavior with iOS / Android SDK and removes short-interval repeat exposures observed in production

## [2.18.0]

### Added

-   Support cancellation conditions for in-web message campaigns
    -   Scheduled web popups (with delay) can now be cancelled when a cancellation event is triggered
    -   Reuses existing triggering condition matching logic for cancellation evaluation

## [2.17.8]

### Added

-   Add `link_open_mode` support for in-web popup links
    -   When `link_open_mode` is set to `'blank'`, links open in external browser with `target="_blank"`
    -   Default behavior (`'self'`) is unchanged for backward compatibility

## [2.17.7]

### Fixed

-   Fix web popup user segment condition evaluation bugs
    -   Fix falsy value (false, 0, "") being converted to null during user attribute extraction
    -   Fix condition evaluation always returning false when comparison value is falsy
    -   Fix null user attribute with `<>` operator now correctly returns true (server behavior match)
    -   Add `NOT_INCLUDE` (array does not contain) operator support

## [2.17.6]

### Fixed

-   Replace indexedDB with local session

# Changelog

## [2.17.5]

### Added

-   Handle external user ID mismatch between database and SDK

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
