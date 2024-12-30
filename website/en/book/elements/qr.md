---
name: QR Code
permaid: qr
---

# QR Code

You can use the QR code element for showing QR codes in your hyperbook.

The QR code element accepts three arguments:

- **value**: The value which is encoded in the QR code.
- **size**: Sets the size of the QR code. You can choose between S, M, L and XL. Defaults to M.
- **label**: The label is shown below the QR code.

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
