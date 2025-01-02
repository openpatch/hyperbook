---
name: Pyide
permaid: pyide
lang: de
---

Das `pyide`-Element repräsentiert eine Python-Integrated-Development-Environment (IDE)-Komponente.
Es wird verwendet, um eine Python-Coding-Umgebung in die Hyperbook-Website einzubetten.
Dieses Element ermöglicht es Benutzern, Python-Code direkt im Browser zu schreiben, zu bearbeiten und auszuführen.

````md
:::pyide

```python
a = 5 + 2
print(a)
```

:::
````

:::pyide

```python
a = 5 + 2
print(a)
```

:::

Sie können auch jedes Paket verwenden, das hier aufgeführt ist: https://pyodide.org/en/stable/usage/packages-in-pyodide.html

````md
:::pyide

```python
import numpy as np

a = np.arange(15).reshape(3, 5)
print(a)
```

:::
````

:::pyide

```python
import numpy as np

a = np.arange(15).reshape(3, 5)
print(a)
```

:::

## Testfälle hinzufügen

Sie können Testfälle zu den Code-Snippets hinzufügen, indem Sie ein `test`-Tag zum Codeblock hinzufügen. Der Kommentar `#SCRIPT#` wird durch den geschriebenen Code ersetzt. Er kann an jeder Stelle des Codeblocks platziert werden.

````md
:::pyide

```python test
#SCRIPT#
r = check_palindrom("uhu")
if r:
    print("Pass")
else:
    print("Fail")
```

```python test
#SCRIPT#
r = check_palindrom("test")
if not r:
    print("Pass")
else:
    print("Fail")
```

```python
def check_palindrom(s):
    return True
```

:::
````

:::pyide

```python test
#SCRIPT#
r = check_palindrom("uhu")
if r:
    print("Pass")
else:
    print("Fail")
```

```python test
#SCRIPT#
r = check_palindrom("test")
if not r:
    print("Pass")
else:
    print("Fail")
```

```python
def check_palindrom(s):
    return True
```

:::

## Input()

Sie können die `input()`-Funktion in den Code-Snippets verwenden. Die `input()`-Funktion wird durch die im `input`-Tag angegebenen Werte ersetzt.
Wenn es mehrere `input()`-Funktionen gibt, werden die Werte in der Reihenfolge bereitgestellt, in der sie im `input`-Tag geschrieben sind.
Wenn Sie `input()` öfter aufrufen als die Anzahl der bereitgestellten Werte, wird ein Fehler ausgelöst.

````md
:::pyide

```input
a
b
c
d
```

```python
print(input())
print(input())
print(input())
print(input())
```

:::
````

:::pyide

```input
a
b
c
d
```

```python
print(input())
print(input())
print(input())
print(input())
```

:::
