---
"@hyperbook/cloud": patch
---

PDF files opened in the editor now show a preview in the browser's built-in PDF viewer instead of the "cannot be edited here" notice. The raw file endpoint serves bytes as an attachment, so the client re-blobs them with the `application/pdf` type, the same way images are shown; a PDF is never classified as editable text. The admin app's CSP now allows `blob:` in `frame-src` for that frame. The tab still offers Download and Replace.
