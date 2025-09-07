---
name: Snippets
lang: de
id: snippets
---

# Snippets

Manchmal möchte mal Elemente wiederhole oder ein eigenes Element erstellen, um z.B. weniger schreiben zu müssen. Snippets erlauben genau das.

:::alert{warn}
Snippets müssen im Ordner `snippets` neben dem `book` und `glossary` Ordner platziert werden. Sie haben die Endung `.md.hbs`.

Hier wird ein großes S für snippet verwendet. Du musst ein kleines s verwenden.
:::

Du kannst in deinen Snippets auf die Hyperbook-Konfiguration zugreifen, indem du z.B. `{{{ hyperbook.name }}}` verwendest.

## Beispiel

### Beispiel 1: Block
Hier ist ein einfaches Beispiel für ein Snippet zur Verwendung eines Protect-Elements mit
demselben Passwort und derselben ID in Ihrem Hyperbook.
Das Snippet in `snippets/password.md.hbs`:
```md
:::protect{id="1" password="hyperbook" description="Das Passwort ist der Name dieses Projekts."}
{{{ content }}}
:::
{{#if hint}}
:::alert{info}
Hyperbook ist das Passwort.
:::
{{/if}}
```
Das Markdown, das Sie in Ihr Hyperbook einfügen müssen:
```md
:::Snippet{#password}
:smiley:
:::
```
Das Ergebnis:
:::snippet{#password}
:smiley:
:::

### Beispiel 2: Dynamische Doppelpunkt-Ebenen
Snippets stellen automatisch Variablen für verschiedene Doppelpunkt-Ebenen bereit, um ordnungsgemäße Verschachtelung zu handhaben:

Das Snippet in `snippets/alert.md.hbs`:
```md
{{{ c1 }}}alert{label="Info" color="#3B82F6"}
{{{ content }}}
{{{ c1 }}}
```

Verfügbare Doppelpunkt-Ebenen-Variablen:
- `c` - Gleiche Anzahl von Doppelpunkten wie der Snippet-Block
- `c1`, `c2`, `c3`, `c4` - Ein bis vier **mehr** Doppelpunkte (für tiefere Verschachtelung)
- `l1`, `l2`, `l3`, `l4` - Ein bis vier **weniger** Doppelpunkte (für oberflächlichere Verschachtelung)

Beispielverwendung mit verschiedenen Verschachtelungsebenen:
```md
::::Snippet{#alert}
Dies wird in einem 5-Doppelpunkt-Alert-Block umschlossen.
::::

::Snippet{#alert}
Dies wird in einem 3-Doppelpunkt-Alert-Block umschlossen.
::
```

Ergebnis:
- Erster Fall: `:::::alert{...}` (4 + 1 = 5 Doppelpunkte mit `c1`)
- Zweiter Fall: `:::alert{...}` (2 + 1 = 3 Doppelpunkte mit `c1`)

Dies gewährleistet ordnungsgemäße Verschachtelung, unabhängig davon, wie tief Ihr Snippet in anderen Markdown-Blöcken verschachtelt ist.

### Example 3: Block mit Parameter

Du kannst auch Parameter für deine Snippets definieren, um sie dynamisch zu machen. Zum Beispiel kann man userem Passwort-Snippet den hint-Parameter übergeben. Wenn dieser übergeben wird, dann wird ein Hinweis gezeigt.

```md
:::Snippet{#password hint=true}

::qr{value="https://hyperbook.openpatch.org" size="XL"}

:::
```

:::snippet{#password hint=true}

::qr{value="https://hyperbook.openpatch.org" size="XL"}

:::

### Example 4: Im Text

```hbs
{{#times n}}
  :smiley:
{{/times}}
```

```md
:Snippet{#smiley n=10}
```

Wir sind zehn Smilies: :snippet{#smiley n=10}

## Parameter

Du kannst Parameter in deinem Snippet verwenden, indem du geschweifte Klammern benutzt.

```hbs
{{{p1}}}
```

Drei geschweifte Klammern geben den rohen Inhalt wieder.

Zwei geschweifte Klammern den HTML-escapten Inhalt.

### Inhalt

Wenn dein Snippet über mehrere Zeilen geht, kannst du den content-Parameter benutzen. Siehe Beispiel 1.

:::alert{warn}
Du solltest drei geschweifte Klammern um den content-Parameter setzen.
:::

## Helpers

Du kannst die folgenden Helfer in deinem Snippet verwenden.

### if

Verwende if, um Blöcke anhand einer Bedingung anzuzeigen.

```hbs
{{#if p}}
  content
{{/if}}
```

### unless

Verwende unless, wenn du das gegenteil von if möchtest.

```hbs
{{#unless hint}}
  content
{{/unless}}
```

### times

Verwende times, wenn du einen Block mehrmals angezeigt haben möchtest.

```hbs
{{#times 10}}
  Hi
{{/times}}
```

### file

Verwende file, wenn du den Inhalt einer anderen Datei einbinden möchtest.

```hbs
{{{file "/archives/project-1/main.c"}}}
```

Du kannst außerdem auch nur ausgewählte Zeilen einbinden.

```hbs
{{{file "/archives/project-1/main.c" "1,3-4"}}}
```

Und du kannst definieren, ob ein Ausblendungssymbol gezeigt werden soll.

```hbs
{{{file "/archives/project-1/main.c" "1,3-4" "// ..."}}}
```

### rfile

rfile funktioniert wie file, aber die Datei wird von der Wurzel eines git-Repository gelesen.

```hbs
{{{rfile "/path/to/file"}}}
```

### base64

Du kannst auch Mediendateien einbetten.

```hbs
{{base64 "path/relative/to/root/folder"}}
```

Dies funktioniert am besten mit dem image Block:

```hbs
![]({{base64 "path/relative/to/root/folder"}})
```

### concat

```hbs
{{concat "Hi" " there"}}
```

Hi there

### camelcase

```hbs
{{camcelcase "This is a test"}}
```

thisIsATest

### pascalcase

```hbs
{{pascalcase "This is a test"}}
```

ThisIsATest

### dashcase

```hbs
{{dashcase "This is a test"}}
```

This-is-a-test

### lowercase

```hbs
{{lowercase "This is a test"}}
```

this is a test

### uppercase

```hbs
{{lowercase "This is a test"}}
```

THIS IS A TEST

### replace

```hbs
{{replace "Give me Banana Banana" "Banana" "Apple"}}
```

Give me Apple Banana

### replaceAll

```hbs
{{replaceAll "Give me Banana Banana" "Banana" "Apple"}}
```

Give me Apple Apple
