---
name: QR Code
lang: de
---

# QR Code

Du kannst das QR Code Element verwenden, um einen QR Code anzeigen zu lassen.

Das QR Code Element akzeptiert drei Argumente:

- **value**: Der Wert, welcher in den QR Code kodiert wird.
- **size**: Die Größe des QR Codes. Du kannst zwichen S, M, L und XL wählen, wobei M gewählt wird, wenn du nichts angibst.
- **label**: Die Text, welcher unterhalb des QR Codes gezeigt wird.

```md
::qr{value="https://hyperbook.openpatch.org" size="XL"}

::qr{value="https://twitter.com/openpatchorg" size="L" label="Folge mir!"}

::qr{value="mailto:mike@openpatch.org" label="Kontaktiere mich!"}

::qr{value="WIFI:T:WPA;S:wlan-kabel;P:top-secret;;" size="S" label="Verknüpfe dich!"}
```

::qr{value="https://hyperbook.openpatch.org" size="XL"}

::qr{value="https://twitter.com/openpatchorg" size="L" label="Folge mir!"}

::qr{value="mailto:mike@openpatch.org" label="Kontaktiere mich!"}

::qr{value="WIFI:T:WPA;S:wlan-kabel;P:top-secret;;" size="S" label="Verknüpfe dich!"}
