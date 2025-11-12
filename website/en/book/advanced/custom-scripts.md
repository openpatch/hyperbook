---
name: Custom Scripts
scripts:
  - /custom_script.js
---

# Custom Scripts

:::alert{warn}
Custom scripts are best used with `allowDangerousHtml` enabled. It is highly recommended to not target hyperbook elements and to only target custom elements. The classes we use for the hyperbook are not considered stable and might change in the future. Therefore, target hyperbook elements only with caution.
:::

```md title="Frontmatter"
scripts:
  - /custom_script.js
```

```js title="custom_script.js"
const colors = ["red", "blue", "yellow", "green", "pink"];
const els = document.getElementsByClassName("random-color");
for (let el of els) {
  setInterval(() => {
    const color = colors[Math.floor(Math.random() * colors.length)];
    el.style.color = color;
  }, 500);
}
```

<div class="random-color">Am I a Chameleon?</div>

## Using the Hyperbook Store API

Hyperbook provides a built-in Dexie database that allows you to store and retrieve custom data in the browser's IndexedDB. This is useful for persisting user preferences, progress tracking, or any other custom data that should survive page reloads.

### Custom Data Table

The hyperbook store includes a `custom` table specifically designed for your custom data needs. The table schema is:

- `id` - A unique identifier for your data entry (string)
- `payload` - Your custom data, typically stored as JSON

### Saving Data

You can save custom JSON data using the `store.custom.put()` method:

```js
// Save user preferences
await store.custom.put({
  id: "user-preferences",
  payload: JSON.stringify({
    theme: "dark",
    fontSize: 16,
    language: "en"
  })
});

// Save user progress
await store.custom.put({
  id: "chapter-progress",
  payload: JSON.stringify({
    currentChapter: 5,
    completedExercises: [1, 2, 3],
    lastVisited: new Date().toISOString()
  })
});
```

### Retrieving Data

You can retrieve your data using the `store.custom.get()` method:

```js
// Get user preferences
const prefs = await store.custom.get("user-preferences");
if (prefs) {
  const preferences = JSON.parse(prefs.payload);
  console.log(preferences.theme); // "dark"
}

// Get user progress
const progress = await store.custom.get("chapter-progress");
if (progress) {
  const data = JSON.parse(progress.payload);
  console.log(data.currentChapter); // 5
}
```

### Complete Example

Here's a complete example that demonstrates saving and loading custom data:

```js title="user-preferences.js"
// Initialize or load preferences
async function initPreferences() {
  const stored = await store.custom.get("my-app-settings");
  
  let settings;
  if (stored) {
    settings = JSON.parse(stored.payload);
  } else {
    // Default settings
    settings = {
      notifications: true,
      autoSave: true,
      lastLogin: new Date().toISOString()
    };
    await savePreferences(settings);
  }
  
  return settings;
}

// Save preferences
async function savePreferences(settings) {
  await store.custom.put({
    id: "my-app-settings",
    payload: JSON.stringify(settings)
  });
}

// Example usage
initPreferences().then(settings => {
  console.log("Current settings:", settings);
  
  // Update a setting
  settings.notifications = false;
  savePreferences(settings);
});
```

### Data Export and Import

Your custom data is automatically included when users export their hyperbook data using the `hyperbookExport()` function. Similarly, it will be restored when they use `hyperbookImport()`. This ensures your custom data is preserved across browser sessions and can be transferred between devices.
