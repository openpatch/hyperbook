---
name: Cloud [Alpha]
index: 3
---

# Cloud [Alpha] 

:::alert{warn}

This feature is still in alpha. It may be buggy and subject to change. Please test it out and share your feedback with us!

:::

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
- **Auto-save indicator** — A status icon shows the current sync state (saved, saving, unsaved, offline).

When logged into the cloud, local export, import, and reset buttons are hidden to prevent conflicts with cloud-managed state.

## Event-Sourcing Architecture

Instead of sending the entire store on every change, Hyperbook Cloud uses an event-sourcing approach for efficient synchronization.

### How It Works

1. **Granular event capture** — Every change to the local Dexie database (create, update, delete) is captured as an individual event via Dexie hooks. Only the changed fields are recorded for updates (deltas), not the full row.
2. **Batched sync** — Events are collected and sent in batches to the cloud server after a debounce period (2 seconds of inactivity or 10 seconds maximum wait).
3. **Server-side snapshots** — The server periodically compacts events into snapshots. After 100 events (configurable via `SNAPSHOT_THRESHOLD` environment variable), a new snapshot is created and old events are pruned.
4. **State reconstruction** — When a student loads their state, the server reconstructs it by applying any events since the last snapshot.

### Large Data Handling

If an event batch exceeds 512 KB (e.g., large Excalidraw drawings or Geogebra states), the client falls back to sending a full snapshot instead of individual events. This prevents bandwidth issues with large binary data.

### Conflict Detection

The client tracks the last known event ID from the server. When sending events, it includes this ID as `afterEventId`. If the server detects that the client is out of date (e.g., another device sent events in the meantime), it responds with a 409 conflict and the client re-fetches the latest state.

### Offline Queue

When the device is offline, events are stored in a local queue with their `afterEventId`. Once the connection is restored, the queue is replayed in order. If a conflict is detected during replay, the client discards the queue and re-fetches from the server.

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

### Event Log

The admin interface provides an event log per group, showing recent events (last 200) and the latest snapshot per student. Teachers and admins can:

- **View the event log** — See all recent database changes across students in a group.
- **Download snapshots** — Download the latest reconstructed state for a student as a JSON file.

Snapshots are labeled with their source: `auto` (created automatically when the event threshold is reached) or `manual` (created from a full snapshot upload, import, or reset).

## Data Flow

### Saving Changes

```
Student interacts with hyperbook
        ↓
Dexie hook captures change as event
        ↓
Events batched (debounced 2s / max 10s)
        ↓
POST /api/store/:hyperbookId/events
        ↓
Events stored on cloud server
```

If the event batch exceeds 512 KB:

```
Batch too large
        ↓
Full Dexie export created
        ↓
POST /api/store/:hyperbookId/snapshot
        ↓
Snapshot replaces all events + previous snapshot
```

### Loading State

```
Student logs in
        ↓
GET /api/store/:hyperbookId
        ↓
Server reconstructs state (snapshot + events)
        ↓
State imported into local IndexedDB
        ↓
Interactive elements restored
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/store/:hyperbookId` | Fetch reconstructed state (snapshot + event replay). |
| `POST` | `/api/store/:hyperbookId/events` | Append a batch of events. Includes `afterEventId` for conflict detection. |
| `POST` | `/api/store/:hyperbookId/snapshot` | Full-state overwrite. Replaces all events and snapshots. |

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `SNAPSHOT_THRESHOLD` | `100` | Number of events before the server automatically creates a new snapshot and prunes old events. |
