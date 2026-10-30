---
"@hyperbook/cloud": minor
---

Hyperbook Cloud now speaks English and German. The language of the pages, API errors and emails is the signed-in user's choice (Your account → Language), else the instance default (Settings → General → Language, "Automatic" follows the browser), else the browser's `Accept-Language`; visitors' choice is kept in the browser, and `<html lang>` is set before the first paint. All emails — address verification, password reset, invitations, sign-up notifications, address decisions — go out in the recipient's language, and form validation messages translate with the UI. The catalogs live in `src/shared/i18n/locales/` (shared by web, API and emails, with typed keys and a test that keeps `de` complete); the auth pages, app shell, landing page and account page are translated, the editor and the remaining admin pages follow area by area.
