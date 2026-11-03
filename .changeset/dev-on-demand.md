---
"hyperbook": minor
"@hyperbook/fs": patch
"@hyperbook/cloud": patch
---

`hyperbook dev` renders a book page by page as you visit it, the way the cloud editor's preview does, instead of building the whole book before it starts. A large book is served in under a second instead of after a full build, and a save shows in a fraction of a second, also for changes that used to rebuild everything (a new or renamed page, a snippet, a template, `hyperbook.json`). After a change the open page reloads and keeps its scroll position, so directives start up exactly as readers see them. A broken page shows its error in place of itself and no longer takes the rest of the book down. The search index, the archives, `llms.txt`, unpacked H5P files and favicons are made the first time they are asked for; to get search and the archives' includes, every page is indexed once in the background, in a separate process. Libraries are still built in full and updated incrementally.

`@hyperbook/fs`: a page whose frontmatter fails to parse now fails again when it is read a second time, instead of passing as a page without frontmatter.
