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

## What teachers see

The login page tells students that their work is saved to their account and that their teacher can see it.

In Hyperbook Cloud, a group's **Overview** tab shows what each student worked on in the published version of the book:

- One column per page with how many of its tasks a student worked on. Click a page to open one column per task, and a filled circle to read that answer (text, code, a tune, a ticked checklist item, …).
- By default only pages someone in the group worked on are shown. A section picker narrows the overview to a chapter. Both choices are remembered per group.
- A dot marks students who were in the book in the last two minutes. The overview refreshes every 30 seconds.
- **Other** lists work that belongs to no task of the published version.
- **Download as CSV** exports what is shown, with usernames and times.

Tasks are text inputs, the code editors and IDEs, structograms, learning maps, drawings, JMP, bitflow, GeoGebra, H5P, multievent, ABC editors and checklist items.

### Keeping students' work when you edit a task

A task's saved work is found by its id. Without an `id`, the id comes from the task's content, so changing the task (even fixing a typo) gives it a new id: the book no longer shows the earlier answers, which then appear under **Other**. Before publishing, Hyperbook Cloud lists the tasks with students' work that would be affected and shows their old ids. Give a changed task its old id to keep the work, for example:

```md
::textinput{id="a1b2c3d4"}
```

Giving important tasks an `id` from the start avoids this.

## What is saved

Once logged in, everything the book's interactive elements store (code editors, bookmarks, drawings, answers, …) is saved to Hyperbook Cloud:

- **Cross-device access**: students continue where they left off on any device.
- **Offline support**: changes made offline are kept and saved when the connection returns.
- **Save indicator**: an icon in the toolbar shows whether everything is saved. Each state has its own badge shape, so it does not rely on color alone, and the button's label reads out the state for screen readers.
- **Sync notices**: states you can act on (a failed save, being offline, work arriving from another device) appear in a notice at the bottom of the page, with a retry or reload button where one applies. Successful saves stay silent.

When logged in, the local export, import and reset buttons are hidden, so they cannot conflict with the saved state.

Ephemeral interface state (cursor position, scroll offset, window size) is not saved: it belongs to one device.

## How saving works

The book's local database is the truth; Hyperbook Cloud keeps a copy of it, row by row.

1. **Every change is marked at once**, on the device, as "not uploaded yet". The mark survives leaving the page, closing the tab and losing the connection.
2. **Marked rows are uploaded** after 1 second without changes (or at most every 5 seconds), when the tab is hidden, and when the next page loads. An upload sends the current value of each marked row; the mark is removed once the server has it. A large backlog goes up in several requests. A row the server refuses (for example because it is too large) is set aside and shown as a save error; the other rows are still uploaded, and the row is tried again when it changes or the student clicks **Retry**.
3. **Each upload advances the student's revision.** A device remembers the last revision it has seen and, on every page load and upload, takes in only the rows other devices uploaded after it.

Uploads over 8 KB are gzip-compressed, which typically makes code, drawings and other element state 3 to 10 times smaller.

Sending a row twice does no harm, so there is nothing to resolve: leaving a page never asks whether to leave, and no save is ever refused as out of date.

### Several devices

If two devices change the same row (the same answer, the same drawing), the change made later wins, going by the clock of each device, however late the other device uploads its change. A school computer that kept a change for a week does not overwrite what the student did at home since; it takes over the newer work instead. A device never overwrites a row it has not uploaded yet with one from another device.

Several tabs of the book on one device share their marks, and take turns uploading.

Work from another device that arrives while a page is open is written to the local database at once. The elements show it after a reload: right away if the student has not changed anything on the page yet, otherwise a notice offers **Reload now**.

The first time a student logs in on a device, and whenever another student logs in on it, the device's local data is replaced by the student's saved work. Logging out uploads what is left and empties the device; if something could not be uploaded, the book asks first.

### Offline and leaving the page

Changes made offline stay marked and are uploaded when the connection returns, also if pages were changed or the browser was closed in between. When a page is hidden, marked rows are also sent with a request that outlives the page (up to 60 KB); the marks stay until a later upload confirms them.

## Running Hyperbook Cloud

Hyperbook Cloud is in `platforms/cloud/` of the Hyperbook repository and runs as a single Docker container. See the [Cloud README](https://github.com/openpatch/hyperbook/tree/main/platforms/cloud) for installation and deployment.

Hyperbook Cloud was built with the help of AI: Claude Opus 5.5 by Anthropic, and GLM 5.3 by Z.ai, run in Mistral Vibe.
