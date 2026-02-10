---
name: Cloud
index: 3
---

# Cloud

Hyperbook Cloud is a self-hosted student management platform that enables user login, progress tracking, and cloud synchronization for your hyperbooks.

## Setup

To connect a hyperbook to a cloud server, add the `cloud` property to your `hyperbook.json`:

```json
{
  "name": "My Hyperbook",
  "cloud": {
    "url": "https://cloud.example.com",
    "id": "my-hyperbook"
  }
}
```

| Property | Description |
|---|---|
| `url` | The URL of your Hyperbook Cloud server. |
| `id` | The slug of the hyperbook as configured in the cloud admin interface. Must match exactly. |

## How It Works

When cloud is configured, a login button appears in the hyperbook. Students log in with the credentials created by their teacher in the cloud admin interface.

Once logged in, the following happens automatically:

- **State synchronization** — All interactive element state (code editors, bookmarks, collapsibles, excalidraw drawings, etc.) is saved to the cloud server.
- **Cross-device access** — Students can continue where they left off on any device.
- **Offline support** — Changes are queued locally when offline and synced when the connection is restored.
- **External databases** — Data from embedded tools like SQL-IDE and LearnJ is also synced.

## Cloud Server

The cloud server is a separate application located in `platforms/cloud/` of the Hyperbook repository. See the [Cloud README](https://github.com/openpatch/hyperbook/tree/main/platforms/cloud) for installation and deployment instructions.

### Key Concepts

- **Hyperbooks** — Each hyperbook is registered in the cloud with a unique slug. This slug is used as the `cloud.id`.
- **Groups** — Students are organized into groups within a hyperbook.
- **Students** — Each student has a username and password for logging into the hyperbook.
- **Teachers** — Teachers can manage groups and students for their assigned hyperbooks.
- **Permissions** — Admins can grant teachers fine-grained permissions per hyperbook.

### Impersonation

Teachers and admins can impersonate a student to view their progress in read-only mode. This opens the hyperbook with the student's saved state without allowing any modifications.

## Data Flow

```
Student interacts with hyperbook
        ↓
Local state saved (IndexedDB)
        ↓
Cloud sync (debounced, automatic)
        ↓
POST /api/store/:hyperbookId
        ↓
Stored per-user on cloud server
```

When the student logs in on another device:

```
Student logs in
        ↓
GET /api/store/:hyperbookId
        ↓
State imported into local storage
        ↓
Interactive elements restored
```

## Import & Export

Cloud sync works alongside the `importExport` feature. Students can still manually export and import their state as a file, even when cloud sync is active.
