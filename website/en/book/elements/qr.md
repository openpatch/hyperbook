---
name: QR Code
permaid: qr
---

# QR Code

You can use the QR code element for showing QR codes in your hyperbook.

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `value` | Value encoded in the QR code | - |
| `size` | Size of the QR code: `S`, `M`, `L`, or `XL` | `M` |
| `label` | Label shown below the QR code | - |

```md
::qr{value="https://hyperbook.openpatch.org" size="XL"}

::qr{value="https://twitter.com/openpatchorg" size="L" label="Follow Me!"}

::qr{value="mailto:mike@openpatch.org" label="Contact Me!"}

::qr{value="WIFI:T:WPA;S:wlan-kabel;P:top-secret;;" size="S" label="Connect Me!"}
```

::qr{value="https://hyperbook.openpatch.org" size="XL"}

::qr{value="https://twitter.com/openpatchorg" size="L" label="Follow Me!"}

::qr{value="mailto:mike@openpatch.org" label="Contact Me!"}

::qr{value="WIFI:T:WPA;S:wlan-kabel;P:top-secret;;" size="S" label="Connect Me!"}
