---
name: Learningmap
permaid: learningmap
---

# Learningmap

The `learningmap` element lets you embed interactive learning roadmaps directly in your Markdown files. You do **not** need to write any HTML.

## Basic Usage

To add a learning map, use the following Markdown block:

````markdown
::learningmap{id="learningmap-example" height="600px" src="test.learningmap"}
````

::learningmap{id="learningmap-example" height="600px" src="test.learningmap"}

## Attributes

| Attribute | Description | Default |
|---|---|---|
| `id` | Unique identifier for the learning map instance | auto-generated |
| `height` | Height of the learning map container, for example `600px` or `100%` | `calc(100vh - 80px)` |
| `src` | Path to the `.learningmap` file | - |

## Editor 

You should use the learningmap editor to create and manage your learning maps. The editor provides a user-friendly interface to design your learning paths and export them as JSON files.

[Open Learningmap Editor](https://learningmap.app/create)

You could also install the VSCode extension for Learningmap for editing learning maps on the fly.
[Learningmap VSCode Extension](https://marketplace.visualstudio.com/items?itemName=openpatch.learningmap-studio)
