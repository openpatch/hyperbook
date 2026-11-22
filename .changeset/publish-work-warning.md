---
"hyperbook": minor
"@hyperbook/cloud": minor
---

Publishing warns before students' work is left without its task. The page check of the latest save now also collects every page's tasks; the publish dialog starts it on its own and lists the tasks of the live version that this save no longer has (removed, or changed without an `id`) and how many students saved work in each, with the old id to give a changed task. The button then reads "Publish anyway". `hyperbook render` reports each page's title and tasks. The class view keeps its table, with the Other column, when no page has work yet.
