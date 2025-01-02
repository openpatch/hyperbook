---
name: Pyide
permaid: pyide
---

The `pyide` element represents a Python Integrated Development Environment (IDE) component.
It is used to embed a Python coding environment within the hyperbook website.
This element allows users to write, edit, and execute Python code directly in the browser.

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

You can also use any package listed here: https://pyodide.org/en/stable/usage/packages-in-pyodide.html

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

<<<<<<< HEAD
:::

## Add test cases

You can add test cases to the code snippets by adding a `test` tag to the code block. The `#SCRIPT#` comment will be replaced by the written code. It can be placed in any part of the code block.

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

You can use the `input()` function in the code snippets. The `input()` function is replaced by the values provided in the `input` tag.
If there are multiple `input()` functions, the values are provided in the order they are written in the `input` tag.
If you call `input()` more times than the number of values provided, the code will throw an error.

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

=======
>>>>>>> main
:::