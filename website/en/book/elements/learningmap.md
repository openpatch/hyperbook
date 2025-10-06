---
name: Learningmap
permaid: learningmap
---

# Learningmap

The `learningmap` element lets you embed interactive learning roadmaps directly in your Markdown files. You do **not** need to write any HTML.

## Basic Usage

To add a learning map, use the following Markdown block:

````markdown
:::learningmap{id="learningmap-example"}

```yaml
title: Modern Web Development Roadmap
background:
  color: '#f8fafc'
  image:
    src: 'learningmap.svg'
    x: 0
    y: 0
edges:
  animated: false
  color: '#94a3b8'
  width: 2
  type: bezier
nodes:
  - id: '1'
    type: topic
    data:
      label: Introduction to HTML
      description: |
        Understand the structure and semantics of HTML documents.
      duration: 1 hour
      unlock: {}
      completion:
        needs:
          - id: "2"
            source: bottom
            target: top
        optional:
          - id: "3"
            source: bottom
            target: top
      video: https://youtube.com/watch?v=UB1O30fR-EE
      resources:
        - label: MDN HTML Introduction
          url: https://developer.mozilla.org/en-US/docs/Web/HTML
        - label: HTML Basics Tutorial
          url: https://www.w3schools.com/html/
  - id: '2'
    type: task
    data:
      label: Write your first HTML file
      description: Create a simple HTML page.
      duration: 1 hour
      resources:
        - label: HTML Page Guide
          url: https://www.freecodecamp.org/news/how-to-build-your-first-web-page/
  - id: '3'
    type: task
    data:
      label: Add a heading and a paragraph
      description: Add basic elements to your HTML page.
      duration: 1 hour
      unlock:
        after:
          - "2"
      resources:
        - label: HTML Elements
          url: https://developer.mozilla.org/en-US/docs/Web/HTML/Element
```
:::
````

:::learningmap{id="learningmap-example"}

```yaml
title: Modern Web Development Roadmap
background:
  color: '#f8fafc'
  image:
    src: 'learningmap.svg'
    x: 0
    y: 0
edges:
  animated: false
  color: '#94a3b8'
  width: 2
  type: bezier
nodes:
  - id: '1'
    type: topic
    data:
      label: Introduction to HTML
      description: |
        Understand the structure and semantics of HTML documents.
      duration: 1 hour
      unlock: {}
      completion:
        needs:
          - id: "2"
            source: bottom
            target: top
        optional:
          - id: "3"
            source: bottom
            target: top
      video: https://youtube.com/watch?v=UB1O30fR-EE
      resources:
        - label: MDN HTML Introduction
          url: https://developer.mozilla.org/en-US/docs/Web/HTML
        - label: HTML Basics Tutorial
          url: https://www.w3schools.com/html/
  - id: '2'
    type: task
    data:
      label: Write your first HTML file
      description: Create a simple HTML page.
      duration: 1 hour
      resources:
        - label: HTML Page Guide
          url: https://www.freecodecamp.org/news/how-to-build-your-first-web-page/
  - id: '3'
    type: task
    data:
      label: Add a heading and a paragraph
      description: Add basic elements to your HTML page.
      duration: 1 hour
      unlock:
        after:
          - "2"
      resources:
        - label: HTML Elements
          url: https://developer.mozilla.org/en-US/docs/Web/HTML/Element
```
:::

## Setting the Height

You can set the height of the learning map by passing a `height` attribute in curly braces after `learningmap`:

````markdown
:::learningmap{height="600px"}

```yaml
# roadmap data here
```
:::
````

- If you do **not** set the `height` attribute, the element will use the full viewport height by default.

## Connecting Nodes with Edges

- Nodes are automatically connected with edges based on the `completion` property of topic nodes.
- The needs list in the `completion` property defines which nodes must be completed before the topic is considered complete.
- You can customize the position of the edges using `source` and `target` properties (top, bottom, left, right).

## Automatic Node Layout

- If a node does **not** specify a `position` (no `x` and `y`), it will be placed automatically by the layout algorithm.
- This keeps your roadmap organized even if you omit manual positions.

## Node Types: Topic and Task

The learningmap element supports two types of nodes:

- **Topic Nodes** (`type: topic`)
- **Task Nodes** (`type: task`)

**Task Nodes**
- Represent individual activities or assignments.
- Should **not** have a `completion` property.
- Are completed directly by the user.

**Topic Nodes**
- Represent broader subjects or modules.
- Should include a `completion` property.
- A topic node is considered completed when all its related tasks or subtopics are completed.
- The `completion` property lists the required nodes (by `id`) that must be completed for the topic to be marked as complete. Add `target` and `source` to customize the direction of edge connections. You can set `bottom`, `top`, `left`, or `right`.

**Example:**

````yaml
nodes:
  - id: '1'
    type: topic
    position:
      x: 0
      y: 0
    data:
      label: "Learn HTML"
      completion:
        needs:
          - id: "2"
          - id: "3"
  - id: '2'
    type: task
    position:
      x: -150
      y: 150
    data:
      label: "Write your first HTML file"
  - id: '3'
    type: task
    data:
      label: "Add a heading and a paragraph"
````

In this example, the topic "Learn HTML" will be marked as completed only when both tasks ("Write your first HTML file" and "Add a heading and a paragraph") are completed.

## Edge Customization

You can customize the appearance of edges connecting nodes using the `edges` property:

````yaml
edges:
  animated: true
  color: '#ff0000'
  width: 3
  type: bezier
````

- `animated`: Set to `true` to enable animated edges. This make all edges dashed and animated.
- `color`: Define the color of the edges using a hex code.
- `width`: Set the width of the edges in pixels.
- `type`: Choose the type of edge. Options include `bezier` or `smoothstep`.

## Unlock Conditions

Nodes can be locked or unlocked based on:

- Completion of other nodes (`after`)
- Specific dates (`date`)
- Passwords (`password`)

**Example:**

````yaml
unlock:
  after:
    - "1"
  date: "2025-10-01"
  password: "webdev2025"
````

## Progress Tracking

- Users can mark nodes as started or completed.
- Progress is shown at the top of the map.
- The progress is saved in your browser. If a id is provided, this will be used
as a key. If no id is provided the content will be hased and an id will be
generated.

## Resources and Videos

- Each node can include resources and a video link for further learning.

## Debug Node

You can display a debug node by pressing **Ctrl + Space** while viewing the learning map.

- The debug node shows the position (`x`, `y`), width, and height of all nodes in the map.
- This is especially useful when you want to create a custom background image that fits the layout of your learning map.
