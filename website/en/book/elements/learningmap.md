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

- `id` (required): A unique identifier for the learning map instance.
- `height` (optional): The height of the learning map container (e.g., `600px`, `100%`).
- `src` (required): The path to the JSON file that defines the learning map structure.

## Editor 

You should use the learningmap editor to create and manage your learning maps. The editor provides a user-friendly interface to design your learning paths and export them as JSON files.

[Open Learningmap Editor](https://learningmap.app/create)

You could also install the VSCode extension for Learningmap for editing learning maps on the fly.
[Learningmap VSCode Extension](https://marketplace.visualstudio.com/items?itemName=openpatch.learningmap-studio)
