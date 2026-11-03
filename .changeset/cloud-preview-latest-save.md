---
"@hyperbook/cloud": patch
---

The publishing card on the book page no longer pretends the preview has to be built. The preview always shows the latest save, so its link is there as soon as the book has any saves, with the time of the last save; the "Build preview" button and the "main is N commits ahead" hint are gone. The live card counts the saved changes that are not live yet, offers Publish for them and shows "Publishing…" while a publish build runs.

Drafting and publishing got easier to follow:

- The publish dialog lists the saves that go live, each opening its diff, plus "Show all changes" for the whole book against the live version.
- Owners can publish from the editor's toolbar, which shows how many saves are not live yet; editors ask the owners there or on the book page. The owners get an email and see the request until they publish or dismiss it.
- A failed publish is shown on the book page with its error and log, and in the editor as a message; the version before stays live.
- The editor's History pane marks the live save and the published versions, and "Compare with the live version" shows what changed in the open file.
- "Check all pages" renders every page of the latest save and lists the ones that fail, before anything is published. An upload starts one.

Only publishing builds now: saves, uploads and git pushes do not, the rebuild endpoint is gone, and the instance setting "A git push also builds the preview" is removed. The upload dialog lists the links it left out. The books table drops `preview_build_id` and gains columns for publish requests (migrations 0015 and 0016).
