---
name: Bitflow
permaid: bitflow
---

# Bitflow

The `bitflow` element embeds a [bitflow](https://bitflow.openpatch.org) assessment — a flow of tasks
your readers work through, marked as they go. It is a good fit for a check-up at the end of a
chapter. You do **not** need to write any HTML.

## Basic Usage

Put a flow file next to your page (or into `public/`) and point the element at it:

```markdown
::bitflow{id="bitflow-example" height="600px" src="quiz.json"}
```

::bitflow{id="bitflow-example" height="600px" src="quiz.json"}

## Attributes

| Attribute  | Description                                            | Default             |
| ---------- | ------------------------------------------------------ | ------------------- |
| `id`       | Unique identifier for this flow                        | auto-generated      |
| `height`   | Height of the container, for example `600px` or `100%` | `600px`             |
| `src`      | Path to the flow file                                  | -                   |
| `locale`   | Interface language (see below)                          | the book's language |
| `readonly` | Show the flow without accepting answers                | off                 |

The flow is read when the book is built, not fetched by the reader's browser. A missing or malformed
file is reported as a build warning naming the page and line, so you hear about it while writing
rather than from a reader looking at a blank space, and a built book needs no network to open an
assessment. The build still finishes — the element simply renders nothing — so check the build output
if an assessment does not appear.

The buttons and feedback the flow shows are translated into `en`, `de`, `fr`, `nl`, `es`, `it`, `pt`
and `tr`. A book in any other language gets the English strings — the questions themselves are always
whatever you wrote in the flow.

## Saving and starting over

Answers are saved in the reader's browser as they go, and are still there when they come back. The
button in the bottom right corner throws the attempt away and starts a fresh one.

If you edit the flow and rebuild the book, an attempt saved against the old version no longer fits.
Rather than showing half a restored attempt, the element quietly starts a new one.

## What a reader downloads

A flow only loads the task types it actually uses. A page with three multiple-choice questions does
not pay for the maths task, which brings a formula editor with it. Nothing is downloaded at all on a
page without a `bitflow` element.

## Authoring

Build a flow at [bitflow.openpatch.org](https://bitflow.openpatch.org) and save it as a file next to
your page. The authoring canvas is not part of the book — a reader only ever sees the flow itself.
