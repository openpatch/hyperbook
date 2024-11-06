---
name: Quelltext
lang: de
---

# Quelltext

```md
Inzeiliger `Quelltext` ist von `rückwärts geneigten Hochkommata` umschlossen.
```

Inzeiliger `Quelltext` ist von `rückwärts geneigten Hochkommata` umschlossen.

Mehrzeilige Quelltextblöcke sind von Zeilen mit drei rückwärts geneigten Hochkommata ``` umschlossen.

````md
```python showLineNumbers title="MyPython.py" {1} /test/#r /Python/#y /syntax/#l
s = "Python syntax highlighting"
print s # test
```

```
Wenn keine Sprache angegeben ist,
dann wir `plain` gesetzt.
```
````

```python showLineNumbers title="MyPython.py" {1} /test/#r /Python/#y /syntax/#l /print/
s = "Python syntax highlighting"
print s # test
```

```
Wenn keine Sprache angegeben ist,
dann wir `plain` gesetzt.
```

## Konfiguration

Du kannst die Standardwerte der Quelltextblöcke in der `hyperbook.json` ändern. Gültige Werte für die Themes findest du hier: https://shiki.style/themes#themes.

```json
{
  "elements": {
    "code": {
      "showLineNumbers": true,
      "theme": {
         "dark": "dracula",
         "light": "evergreen"
      }
    }
  }
}
```
