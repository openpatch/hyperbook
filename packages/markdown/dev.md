# Test Site

:::pyide

```input
test
bla
```

```python test
a = 5
_i = -1
_values = ["test", "bla"]
def input():
    global _i
    global _values
    _i += 1
    return _values[_i]
#SCRIPT#
if a == 5:
    print("a is 5")
else:
    print("a is not 5")
```

```python test
a = 5
_i = -1
_values = ["test", "bla"]
def input():
    global _i
    global _values
    _i += 1
    return _values[_i]
#SCRIPT#
if a == 5:
    print("a is 7")
else:
    print("a is not 7")
```

```python
a += 2
print(a)
print(input())
```

:::


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

:::pyide


```python
import numpy as np

a = np.arange(15).reshape(3, 5)
print(a)
```

:::
