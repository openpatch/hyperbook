---
name: Vorlagen
lang: de
---

# Vorlagen

Manchmal möchtest du wiederholende Layouts in deinem Hyperbook verwenden. Mit Vorlagen kannst du dies machen.
Du definierst eine Vorlagen, indem du eine `.hbs.md` Datei in den `templates` folder legst.
Dann erstellst du im `book`-Ordner `.yml` oder `.json`-Dateien. Diese
müsse eine `template`-Eigenschaft haben, welche eine Vorlage aus dem
`template`-Ordner referenziert.

## Beispiel

Die Vorlagen befindet sich in `templates/template-demo.md`:

```md
---
name: { { name } }
hide: true
---

# Beschreinung

{{ description }}

Vorlagen werden zuerst verabeitet, also kannst du auch Snippets benutzen.

:Snippet{#smiley n=5}
```

Im `book`-Ordner können wir die Vorlage verwenden indem wir YAML oder JSON dateien anlegen:

```json
{
  "template": "template-demo",
  "name": "Vorlage - Demo",
  "description": "Hallo ich bin eine Demo für JSON"
}
```

[Resultierende Seite für JSON](/advanced/template-demo-json)

```yaml
template: template-demo
name: Vorlagen - Demo
description: |
  Hallo ich bin eine Demo
  für YAML.
```

[Resultierende Seite für YAML](/advanced/template-demo-yaml)
