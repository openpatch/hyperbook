---
"@hyperbook/cloud": minor
---

AI assistant: model costs are entered as provider prices (€/M tokens) in the instance settings, with a configurable credit value (1 credit = X €) and buffer; quota weights are derived from them. A "Fetch prices" button prefills the fields from the provider's /models pricing or a models.dev catalog. The editor's model picker sorts by cost, shows precise weights, and the admin hints explain the cached-token rule and the credit value dynamically. Also fixes the preview build button staying disabled for newly created books (source is now "main has commits", not "a build exists").
