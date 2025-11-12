---
name: Benutzerdefinierte Skripte
scripts:
  - /custom_script.js
lang: de
---

# Benutzerdefinierte Skripte

:::alert{warn}
Benutzerdefinierte Skripte sollten am besten mit aktivierter Option `allowDangerousHtml` verwendet werden. Es wird dringend empfohlen, keine Hyperbook-Elemente anzusprechen und nur benutzerdefinierte Elemente zu targeten. Die Klassen, die wir für das Hyperbook verwenden, gelten nicht als stabil und könnten sich in der Zukunft ändern. Daher sollten Hyperbook-Elemente nur mit Vorsicht angesprochen werden.
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

## Verwendung der Hyperbook Store API

Hyperbook stellt eine integrierte Dexie-Datenbank zur Verfügung, mit der du benutzerdefinierte Daten in der IndexedDB des Browsers speichern und abrufen kannst. Dies ist nützlich zum Speichern von Benutzereinstellungen, Fortschrittsverfolgung oder anderen benutzerdefinierten Daten, die nach dem Neuladen der Seite erhalten bleiben sollen.

### Custom Data Tabelle

Der Hyperbook-Store enthält eine `custom`-Tabelle, die speziell für deine benutzerdefinierten Datenanforderungen entwickelt wurde. Das Tabellenschema ist:

- `id` - Eine eindeutige Kennung für deinen Dateneintrag (String)
- `payload` - Deine benutzerdefinierten Daten, typischerweise als JSON gespeichert

### Daten speichern

Du kannst benutzerdefinierte JSON-Daten mit der Methode `store.custom.put()` speichern:

```js
// Benutzereinstellungen speichern
await store.custom.put({
  id: "user-preferences",
  payload: JSON.stringify({
    theme: "dark",
    fontSize: 16,
    language: "de"
  })
});

// Benutzerfortschritt speichern
await store.custom.put({
  id: "chapter-progress",
  payload: JSON.stringify({
    currentChapter: 5,
    completedExercises: [1, 2, 3],
    lastVisited: new Date().toISOString()
  })
});
```

### Daten abrufen

Du kannst deine Daten mit der Methode `store.custom.get()` abrufen:

```js
// Benutzereinstellungen abrufen
const prefs = await store.custom.get("user-preferences");
if (prefs) {
  const preferences = JSON.parse(prefs.payload);
  console.log(preferences.theme); // "dark"
}

// Benutzerfortschritt abrufen
const progress = await store.custom.get("chapter-progress");
if (progress) {
  const data = JSON.parse(progress.payload);
  console.log(data.currentChapter); // 5
}
```

### Vollständiges Beispiel

Hier ist ein vollständiges Beispiel, das das Speichern und Laden benutzerdefinierter Daten demonstriert:

```js title="user-preferences.js"
// Einstellungen initialisieren oder laden
async function initPreferences() {
  const stored = await store.custom.get("my-app-settings");
  
  let settings;
  if (stored) {
    settings = JSON.parse(stored.payload);
  } else {
    // Standardeinstellungen
    settings = {
      notifications: true,
      autoSave: true,
      lastLogin: new Date().toISOString()
    };
    await savePreferences(settings);
  }
  
  return settings;
}

// Einstellungen speichern
async function savePreferences(settings) {
  await store.custom.put({
    id: "my-app-settings",
    payload: JSON.stringify(settings)
  });
}

// Beispielverwendung
initPreferences().then(settings => {
  console.log("Aktuelle Einstellungen:", settings);
  
  // Eine Einstellung aktualisieren
  settings.notifications = false;
  savePreferences(settings);
});
```

### Datenexport und -import

Deine benutzerdefinierten Daten werden automatisch eingeschlossen, wenn Benutzer ihre Hyperbook-Daten mit der Funktion `hyperbookExport()` exportieren. Ebenso werden sie wiederhergestellt, wenn sie `hyperbookImport()` verwenden. Dadurch wird sichergestellt, dass deine benutzerdefinierten Daten über Browser-Sitzungen hinweg erhalten bleiben und zwischen Geräten übertragen werden können.
