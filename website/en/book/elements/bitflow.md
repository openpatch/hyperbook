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
| `height`   | Height of the container, for example `600px` or `100%`; `auto` grows with the flow | `600px`             |
| `maxHeight` | The most the container grows to, with `height="auto"` or a fixed `height` alike, for example `80vh`; beyond it the step scrolls | -       |
| `src`      | Path to the flow file                                  | -                   |
| `locale`   | Interface language (see below)                          | the book's language |
| `readonly` | Show the flow without accepting answers                | off                 |

On a narrow screen the flow never grows past what fits under the book's header, whatever `height` you
gave it — Check, Back and Next stay in view, and the step scrolls inside its own box rather than the
whole page scrolling around it.

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

## Printing

Printing the page — from the browser, or from a flow's own `end-certificate` step — prints every step
of the flow, not just whatever fit inside the container on screen. The reset button and the Check/Back/
Next bar are left off the printed page, since neither means anything on paper.

## What a reader downloads

A flow only loads the task types it actually uses. A page with three multiple-choice questions does
not pay for the maths task, which brings a formula editor with it. Nothing is downloaded at all on a
page without a `bitflow` element.

## Authoring

Build a flow at [bitflow.openpatch.org](https://bitflow.openpatch.org) and save it as a file next to
your page. The authoring canvas is not part of the book — a reader only ever sees the flow itself.
