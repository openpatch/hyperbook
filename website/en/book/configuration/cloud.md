---
name: Cloud [Alpha]
index: 3
---

# Cloud [Alpha]

:::alert{warn}

This feature is still in alpha. It may be buggy and subject to change. Please test it out and share your feedback with us!

:::

Hyperbook Cloud is a self-hosted platform for teachers. It publishes books, gives students anonymous accounts, and saves what students do in a book's interactive elements, so they can continue on any device.

## Books hosted on Hyperbook Cloud

If you upload your book to Hyperbook Cloud, there is nothing to configure. The platform builds your book and connects it to itself: a login button appears in the book, and the printed QR codes log students in directly.

A book on Hyperbook Cloud can be **public** (anyone can read it, students log in to save their work) or **private** (only its students can read it; everyone else is asked to log in first).

## Books hosted elsewhere

A book on GitHub Pages or any other web host can still use Hyperbook Cloud for student accounts. Create the book in Hyperbook Cloud, mark it as "hosted elsewhere" with its address, and add the `cloud` property to your `hyperbook.json`:

```json
{
  "name": "My Hyperbook",
  "cloud": {
    "url": "https://physics.example.page",
    "id": "physics"
  }
}
```

| Property | Description |
|---|---|
| `url` | The book's address on Hyperbook Cloud, as shown on the book's page there. |
| `id` | The book's address name on Hyperbook Cloud (the first part of `url`). |

Hyperbook Cloud only accepts requests from the address you entered for the book, so the book has to run there.

## Logging in

Students log in with the username and password from their login card, or by scanning its QR code. The login form has a **shared device** option: the student is then logged out when the browser is closed. Otherwise a login lasts 30 days.

Teachers can open a student's work with **View as student** in Hyperbook Cloud. The book then shows a banner with the student's name and saves nothing.

## What is saved

Once logged in, everything the book's interactive elements store (code editors, bookmarks, drawings, answers, …) is saved to Hyperbook Cloud:

- **Cross-device access**: students continue where they left off on any device.
- **Offline support**: changes made offline are kept and saved when the connection returns.
- **Save indicator**: an icon in the toolbar shows whether everything is saved. Each state has its own badge shape, so it does not rely on color alone, and the button's label reads out the state for screen readers.
- **Sync notices**: states you can act on (a failed save, being offline, a merge with another session) appear in a notice at the bottom of the page, with a retry button where one applies. Successful saves stay silent.

When logged in, the local export, import and reset buttons are hidden, so they cannot conflict with the saved state.

Ephemeral interface state (cursor position, scroll offset, window size) is not saved: it belongs to one device.

## How saving works

Hyperbook Cloud saves changes, not the whole store:

1. **Changes are recorded** as they happen: every create, update and delete in the book's local database, and for updates only the changed fields.
2. **They are sent in batches** after 2 seconds without changes (or at most every 10 seconds).
3. **The server folds them together** into one snapshot after 100 changes.
4. **Loading rebuilds the state** from the snapshot and the changes after it.

A batch larger than 512 KB (large drawings, for example) is sent as a full snapshot instead.

### Two devices at once

Each save names the last state the device knew. If another device saved in between, the server refuses the save, and the device:

1. loads the current state,
2. applies its own unsaved changes on top of it, locally and on the server,
3. explains the merge in a notice and reloads the page, so the elements show the merged state. The notice offers a **Reload now** button.

Nothing is lost in a merge. The server checks and saves in one step, so two devices saving at the same moment cannot both pass.

### Offline and leaving the page

Changes made offline wait in a queue and are sent in order when the connection returns; if another device saved in the meantime, they are merged as above. The queue holds at most 100 batches; beyond that it is sent as one snapshot.

When the page is closed while changes are still waiting, they are sent with a request that outlives the page. Batches over 60 KB cannot be sent this way; the browser's "unsaved changes" prompt is then the cue to wait.

## Running Hyperbook Cloud

Hyperbook Cloud is in `platforms/cloud/` of the Hyperbook repository and runs as a single Docker container. See the [Cloud README](https://github.com/openpatch/hyperbook/tree/main/platforms/cloud) for installation and deployment.
