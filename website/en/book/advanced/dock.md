---
name: Dock
permaid: dock
---

# Dock

A page often has one working element — an IDE, a drawing, a text field — and many tasks around it with pictures and diagrams. Scrolling between the two loses the element from view.

Add `dock` to an element and readers get a **Dock** tab under it. The element moves into the dock at the right edge of the screen (on phones: at the bottom) and stays there while they scroll through the tasks. The text makes room for the dock.

- Several docked elements share the dock as tabs.
- The rail on the dock's edge slides it in and out; dragging the rail resizes it.
- Where the element was, a line shows it in the dock when clicked; ↩ brings it back.
- The element keeps its state: it is never re-created, only moved on screen.

## Usage

```md
:::pyide{dock}
:::

::textinput{dock="My notes"}
```

| Value | Effect |
| --- | --- |
| no `dock` | The element can't be docked (default). |
| `dock` | It can; the tab is named after the element's kind (Python, Notes, …). |
| `dock="Label"` | It can, and the tab shows `Label`. |
| `dock=false` | It can't. |

`dock` works on `pyide`, `webide`, `p5`, `openscad`, `typst`, `onlineide`, `sqlide`, `excalidraw` and `textinput`.

## Example: a worksheet

Try **Dock** on several of the elements below, then scroll through the tasks.

:::pyide{dock height=400}

```python
numbers = [3, 1, 4, 1, 5, 9, 2, 6]
print(numbers)
```

:::

::textinput{dock placeholder="Notes for the tasks …"}

### Task 1: Sum

Write a program that adds up all numbers in the list `numbers`. Use a loop, not the built-in `sum`. Note your idea in the text field first.

![](/clouds.jpg)

### Task 2: Draw the flow

Sketch the flow of your program from task 1 as a diagram.

::excalidraw{dock="Flow" edit=true aspectRatio="4/3"}

### Task 3: Maximum

Find the largest number without using `max`. Which value do you start with?

| Pass | Element | Largest so far |
| --- | --- | --- |
| 1 | 3 | 3 |
| 2 | 1 | 3 |
| 3 | 4 | 4 |
| 4 | 1 | 4 |
| 5 | 5 | 5 |

### Task 4: The same in Java

:::onlineide{dock height=400}

```java Main.java
println("Hello World");
```

:::

Print every even number from 1 to 100.

### Task 5: Query the rivers

:::sqlide{dock}

```mysql Statements.sql
SELECT * FROM fluss;
```

::file{path="setup.sql" src="/setup.sql"}

:::

Which river is the longest? Write a query that answers it with one row.

### Task 6: A sketch

:::p5{dock mode="editor" height=400}

```js
function setup() {
  createCanvas(200, 200);
}

function draw() {
  background(220);
  circle(mouseX, mouseY, 20);
}
```

:::

Change the sketch so the circle leaves a trail.

### Task 7: A web page

:::webide{dock height=400}

```html
<!DOCTYPE html>
<html>
  <body>
    <h1>My numbers</h1>
  </body>
</html>
```

:::

Show the list of numbers from task 1 as an HTML list.

### Bonus

Write a function `median(list)` that returns the median. Test it with lists of even and odd length.

![](/clouds.jpg)
