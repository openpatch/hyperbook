---
name: Text Input
permaid: textinput
---

# Text Input

The text input directive allows users to input and save text directly in the page. The input is automatically saved to the browser's local storage using Dexie, so it persists across page reloads.

## Basic Usage

```md
::textinput
```

::textinput

## With Placeholder

You can add a placeholder to guide users on what to input:

```md
::textinput{placeholder="Your solution"}
```

::textinput{placeholder="Your solution"}

## With Custom Height

Adjust the height of the text input area:

```md
::textinput{height="400px"}
```

::textinput{height="400px"}

## With Both Options

Combine placeholder and height for a fully customized text input:

```md
::textinput{placeholder="Enter text here" height="300px"}
```

::textinput{placeholder="Enter text here" height="300px"}

## With Custom ID

You can specify a custom ID to have multiple independent text inputs on the same page:

```md
::textinput{id="answer-1" placeholder="First answer"}

::textinput{id="answer-2" placeholder="Second answer"}
```

::textinput{id="answer-1" placeholder="First answer"}

::textinput{id="answer-2" placeholder="Second answer"}

:::alert{info}
The text you enter is automatically saved to your browser's local storage and will persist even after refreshing the page. Each text input is identified by a unique ID, so you can have multiple independent inputs on the same page.
:::
