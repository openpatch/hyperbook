---
"@hyperbook/cloud": patch
---

The front address of an instance now shows a landing page: a short introduction to Hyperbook and the three ways to run it — hosted on hyperbook.cloud by OpenPatch (with a "Create an account" button when the admin's sign-up mode allows it), self-hosted with the one-container Docker setup, or deployed anywhere as a static site with the Hyperbook CLI — plus a login link for the admin frontend and the usual "Built with ❤️ by OpenPatch" footer. Logged-in users go straight to their books. Under Settings → General, admins can turn the landing page off (`landingPage`); then the front address shows only the login screen.
