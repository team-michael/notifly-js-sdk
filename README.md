# Notifly Javascript SDK

![npm](https://img.shields.io/npm/v/notifly-js-sdk)
![Downloads](https://img.shields.io/npm/dt/notifly-js-sdk)

_Notifly SDK for Javascript_ is an easy-to-use package for integrating Notifly with your browser JS applications.

## Installation

To install the package, run the following command:

```
npm install notifly-js-sdk@latest --save
```

or

```
yarn add notifly-js-sdk@latest
```

## Web push consent buttons

Choose **Web push consent** for a web popup button in the Notifly console. A compatible SDK enables the button when the popup is ready. The action runs independently of `allowUserSuppliedLogEvent` and requires no additional initialization option.

An explicit click records `$web_push_consent: true` and `$web_push_consented_at` as a UTC ISO 8601 timestamp, then directly requests browser notification permission without the Notifly permission prompt. Persistence and analytics do not delay the browser request. On grant, the SDK registers the push subscription and closes the popup. Denied, dismissed, unsupported, and failed requests show a message in the original popup. A browser denial does not revoke the separately recorded consent.

The HTML bridge uses `web_push_consent` as a button action, not an analytics event. Only the current popup and user are accepted. The SDK ignores duplicate pending clicks, reuses the same consent timestamp for retries in one popup, and prevents pending work from attaching a subscription to another user after a login change.

Disable the site's automatic Notifly permission prompt when adopting this flow. Browser permission already set to `granted` or `denied` is not requested again. HTTPS and browser web push support are required; iOS/iPadOS also require a supported Home Screen web app. The browser controls whether its permission UI is shown.

## Deployment

1. Update version in `package.json` file.
2. Write a changelog in `CHANGELOG.md` file.
3. Run github workflow `Release` to create a new release.
