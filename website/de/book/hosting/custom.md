---
name: Eigene Lösung
lang: de
---

# Auf eigenen Server bereitstellen

Du muss nur den Ausgabeordner auf deinen Server kopieren, nachdem du den build Befehl ausgeführt hast.

```
npx hyperbook build

cp -R .hyperbook/out /var/www/my-website
```

:::alert{warn}
Wenn du Hyperbook aus einem Unterverzeichnis bereitstellen möchtest, dann musst die basePath Option in der [Hyperbook Konfiguration](/configuration/book) setzen.
:::
