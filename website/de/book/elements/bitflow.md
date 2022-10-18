---
name: Bitflow
lang: de
---

# Bitflow

[Bitflow](https://bitflow.openpatch.org/) ist eine gute Möglichkeit um
dynamische flow-basierte Tests durchzuführen. Es kann zum Beispiel am Ende
eines Kapitels eingesetzt werden, als ein Check up.

## Flow

```md
::flow{src="/flow.json"}
```

::flow{src="/flow.json"}

Die Höhe eines Flows ist standardmäßig 400px. Sie kann aber überschreiben werden.

```md
::flow{src="/flow.json" height="800px"}
```

::flow{src="/flow.json" height="800px"}

## Task

```md
::task{src="/task.json"}
```

::task{src="/task.json"}

Die Höhe einer Aufgabe ist standardmäßig 400px. Sie kann aber überschreiben werden.

```md
::task{src="/task.json" height="800px"}
```

::task{src="/task.json" height="800px"}
