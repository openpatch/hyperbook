---
name: Code
permaid: code
prev:
---

# Code

```md
Inline `code` has `back-ticks around` it.
```

Inline `code` has `back-ticks around` it.

Multiline code block are fenced by lines with three back-ticks ```.

````md
```python showLineNumbers title="MyPython.py" {1} /test/#r /Python/#y /syntax/#l /print/
s = "Python syntax highlighting"
print s
```

```
If no language is indicated,
the language will be guessed.
If you do not want syntax-highlighting,
uses the language `plain`.
```
````

```python showLineNumbers title="MyPython.py" {1} /test/#r /Python/#y /syntax/#l /print/
s = "Python syntax highlighting"
print s
```

```
If no language is indicated,
plain will be used.
```

## Configuration

You can define default values for code blocks in your `hyperbook.json`. You can find valid values for themes here: https://shiki.style/themes#themes.

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
