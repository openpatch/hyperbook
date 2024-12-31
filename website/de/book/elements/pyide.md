---
name: Pyide
permaid: pyide
lang: de
---

Das `pyide`-Element repräsentiert eine Python-Integrated-Development-Environment (IDE)-Komponente.
Es wird verwendet, um eine Python-Coding-Umgebung in die Hyperbook-Website einzubetten.
Dieses Element ermöglicht es Benutzern, Python-Code direkt im Browser zu schreiben, zu bearbeiten und auszuführen.

```md
:::pyide


```python
a = 5 + 2
print(a)
```
:::


```

:::pyide


```python
a = 5 + 2
print(a)
```

:::

Sie können auch jedes Paket verwenden, das hier aufgeführt ist: https://pyodide.org/en/stable/usage/packages-in-pyodide.html

```md
:::pyide


```python
import numpy as np

a = np.arange(15).reshape(3, 5)
print(a)
```

:::
```

:::pyide


```python
import numpy as np

a = np.arange(15).reshape(3, 5)
print(a)
```

:::