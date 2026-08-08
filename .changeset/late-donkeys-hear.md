---
"@hyperbook/types": minor
"@hyperbook/markdown": minor
"hyperbook": minor
"hyperbook-studio": minor
---

Configure an element under `elements`, by the name you write it with.

What you put there is a default for the parameters of that element, used
wherever the element does not set that parameter itself:

```json
{
  "elements": {
    "sqlide": { "height": "500px" },
    "qr": { "size": "L" }
  }
}
```

This works for every element, not only the handful that read the configuration
themselves, because the defaults are filled in before the elements are read.
