---
"@hyperbook/markdown": minor
"hyperbook-studio": minor
---

Add the `bitflow` element, which embeds a [bitflow](https://bitflow.openpatch.org) assessment:

```markdown
::bitflow{src="quiz.json"}
```

The flow is read from `src` when the book is built and inlined into the page, so a missing or
malformed file is reported as a build warning and a built book opens an assessment without a network.
Answers are saved as the reader goes and restored on their next visit; a button starts a fresh
attempt.

Only the learner-facing flow is embedded — bitflow's authoring canvas is not part of a book — and a
flow downloads only the task types it actually uses.

bitflow's own theme is light-only, so a dark book supplies the dark half itself, including both
halves of each feedback pair — a marked answer takes its background from `--bitflow-color-*-surface`
and its label from the general text colour, so re-tinting only one of them leaves the answer
unreadable.
