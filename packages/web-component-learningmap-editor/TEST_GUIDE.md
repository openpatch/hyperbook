# Hyperbook Learningmap Editor - Complete Test Guide

This test file demonstrates all the features of the learningmap-editor web component.

## Setup

1. Build the component:
   ```bash
   pnpm build
   ```

2. Open `index.html` in a web browser

## Features to Test

### 1. Node Management
- ✅ Click "Add Task" button to create a new task node
- ✅ Click "Add Topic" button to create a new topic node
- ✅ Click on any node to open the editor drawer
- ✅ Drag nodes to reposition them

### 2. Node Editing (in the drawer)
- ✅ Change node type between Task and Topic
- ✅ Edit label (required field)
- ✅ Edit summary (shown on the node)
- ✅ Edit description (detailed text)
- ✅ Set duration (e.g., "30 min")
- ✅ Set video URL (YouTube or direct video link)

### 3. Resources
- ✅ Click "Add Resource" to add a new resource
- ✅ Fill in label and URL for each resource
- ✅ Click trash icon to remove a resource

### 4. Unlock Rules
- ✅ Set a password to unlock the node
- ✅ Set a date when the node unlocks
- ✅ List comma-separated node IDs that must be completed first

### 5. Completion Rules
- ✅ Set "Completion Needs" - nodes that must be completed
- ✅ Set "Completion Optional" - optional nodes for full completion

### 6. Background Settings
- ✅ Click "Background" button in toolbar
- ✅ Change background color using color picker
- ✅ Add background image URL
- ✅ Adjust image X and Y positions

### 7. Edge Management
- ✅ Drag from a node's handle to another node to create an edge
- ✅ Edges are automatically created from completion needs if not specified

### 8. Save Functionality
- ✅ Click "Save" button in toolbar
- ✅ Check the output box for the saved roadmap data
- ✅ Verify the change event is fired with complete data

### 9. Delete Nodes
- ✅ Click "Delete Node" button in the editor drawer
- ✅ Verify node and connected edges are removed

### 10. Initial Data Loading
- ✅ Component initializes with the sample data
- ✅ Two nodes are visible: "Getting Started" (task) and "Advanced Topics" (topic)
- ✅ Background has a light blue color (#f0f9ff)

## Data Structure

The component expects and outputs data in this format:

```json
{
  "nodes": [
    {
      "id": "node1",
      "type": "task",
      "position": { "x": 100, "y": 100 },
      "data": {
        "label": "Node Label",
        "summary": "Short summary",
        "description": "Detailed description",
        "duration": "30 min",
        "video": "https://youtube.com/...",
        "resources": [
          { "label": "Resource Name", "url": "https://..." }
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
  "edges": [
    {
      "id": "node1->node2",
      "source": "node1",
      "target": "node2"
    }
  ],
  "background": {
    "color": "#ffffff",
    "image": {
      "src": "bg.png",
      "x": 0,
      "y": 0
    }
  },
  "edgeConfig": {
    "animated": false,
    "color": "#94a3b8",
    "width": 2,
    "type": "default"
  }
}
```

## Known Limitations

1. Node IDs are auto-generated as "node1", "node2", etc.
2. The component doesn't validate unlock/completion references
3. Background image must be publicly accessible
4. Video URLs work best with YouTube or direct video files

## Browser Console Testing

Open browser console and try:

```javascript
// Get the editor element
const editor = document.getElementById('editor');

// Listen for changes
editor.addEventListener('change', (e) => {
  console.log('Roadmap saved:', e.detail);
});

// Programmatically set data
const newData = {
  nodes: [],
  edges: [],
  background: { color: "#fff" }
};
editor.setAttribute('roadmap-data', JSON.stringify(newData));
```
