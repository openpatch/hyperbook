---
name: Vercel
lang: de
---

# Deploy on Vercel

Zuerst musst du eine `vercel.json`-Datei erstellen mit dem folgenden Inhalt:

```json
{
  "cleanUrls": true
}
```

Danach kannst du ein neues Project auf Vercel erstellen.

Benutze `Other` als framework preset.

Für den `build command` benutze:

```
npx hyperbook build
```

Für den `output directory` benutze:

```
.hyperbook/out
```

Jetzt ist alles eingerichtet. Viel Spaß mit deinem Hyperbook!
