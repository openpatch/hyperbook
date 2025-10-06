# @hyperbook/web-component-learningmap-editor

A web component for editing learning maps/roadmaps with drag-and-drop nodes, customizable settings, and visual editing capabilities.

## Features

- **Visual Editor**: Drag-and-drop interface for creating and positioning nodes
- **Node Types**: Support for Task and Topic nodes
- **Node Settings**: Edit labels, descriptions, resources, durations, and more
- **Unlock Rules**: Configure password, date, and dependency-based unlocking
- **Completion Rules**: Set completion needs and optional dependencies
- **Background Customization**: Configure background color and images
- **Auto-Layout**: Automatic node positioning using ELK algorithm
- **Edge Management**: Connect nodes with customizable edges

## Usage

```html
<hyperbook-learningmap-editor
  roadmap-data='{"nodes": [], "edges": []}'
  language="en"
></hyperbook-learningmap-editor>
```

## Events

The component fires a `change` event when the Save button is pressed:

```javascript
const editor = document.querySelector('hyperbook-learningmap-editor');
editor.addEventListener('change', (event) => {
  const roadmapData = event.detail;
  console.log('Roadmap data:', roadmapData);
});
```

## Roadmap Data Format

```json
{
  "nodes": [
    {
      "id": "node1",
      "type": "task",
      "position": { "x": 0, "y": 0 },
      "data": {
        "label": "Introduction",
        "description": "Learn the basics",
        "resources": [
          { "label": "Documentation", "url": "https://example.com" }
        ],
        "unlock": {
          "password": "secret",
          "date": "2024-01-01",
          "after": ["node0"]
        },
        "completion": {
          "needs": [{ "id": "node0" }],
          "optional": [{ "id": "node2" }]
        }
      }
    }
  ],
  "edges": [],
  "background": {
    "color": "#ffffff",
    "image": {
      "src": "bg.png",
      "x": 0,
      "y": 0
    }
  }
}
```
