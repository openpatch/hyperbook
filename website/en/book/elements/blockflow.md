---
name: Blockflow
permaid: blockflow
---

# Blockflow

[Blockflow](https://blockflow.openpatch.org) is a fork of Scratch for building guided tutorials. Hyperbook provides two directives for embedding Blockflow: a **player** for playing tutorials and an **editor** for creating them.

## Player

The Blockflow Player embeds a player for playing Scratch-based guided tutorials.

```md
::blockflow-player{src="https://hyperbook.openpatch.org/elements/platformer.sb3"}
```

::blockflow-player{src="https://hyperbook.openpatch.org/elements/platformer.sb3"}

### Player Arguments

- **src**: The URL pointing to an `.sb3` file.
- **width**: The width of the player. Defaults to `100%`.
- **height**: The height of the player. Defaults to `600px`.

## Editor

The Blockflow Editor embeds an editor for creating Scratch-based guided tutorials. You can define tutorial steps directly in markdown, and the configuration is generated automatically at build time.

### Basic Usage

```md
::::blockflow-editor{title="My Tutorial" src="./platformer.sb3"}

:::step{title="Welcome"}
This is the first step of the tutorial.
:::

:::step{title="Move the Cat"}
Use the move block to move the cat 10 steps.
:::

::::
```

::::blockflow-editor{title="My Tutorial" src="./platformer.sb3"}

:::step{title="Welcome"}
This is the first step of the tutorial.
:::

:::step{title="Move the Cat"}
Use the move block to move the cat 10 steps.
:::

::::

### Steps

Each step is defined with a `:::step` directive inside the editor block. Steps support the following attributes:

- **title**: The title of the step.
- **image**: An optional image URL for the step.
- **video**: An optional video URL for the step.

The text content of the step is used as the step description.

```md
::::blockflow-editor{title="Tutorial" src="./project.sb3"}

:::step{title="Welcome" image="./welcome.png"}
Welcome to this tutorial!
:::

:::step{title="Watch this" video="./demo.mp4"}
Watch the video to see how it works.
:::

::::
```

### Toolbox Configuration

You can restrict which block categories and blocks are available in the editor using the `categories` and `blocks-<category>` attributes.

- **categories**: A comma-separated list of block categories to show, e.g. `"motion,events,control,operators"`.
- **blocks-\<category\>**: A comma-separated list of block IDs available in a specific category, e.g. `blocks-motion="motion_movesteps,motion_turnright"`.

```md
::::blockflow-editor{title="Tutorial" src="./project.sb3" categories="motion,events,control" blocks-motion="motion_movesteps,motion_turnright,motion_turnleft"}

:::step{title="Step 1"}
Try using the motion blocks!
:::

::::
```

### UI Configuration

- **allowExtensions**: Whether to allow Scratch extensions. Set to `"false"` to disable. Defaults to `true`.
- **showCostumesTab**: Whether to show the Costumes/Backdrops tab. Set to `"false"` to hide. Defaults to `true`.
- **showSoundsTab**: Whether to show the Sounds tab. Set to `"false"` to hide. Defaults to `true`.

```md
::::blockflow-editor{title="Tutorial" src="./project.sb3" allowExtensions="false"}

:::step{title="Step 1"}
Let's get started!
:::

::::
```

### Project File

Instead of configuring the editor inline, you can provide a URL to a `.json` project file using the `project` attribute. This is useful when you want to reuse a configuration or manage it externally. You can use the [Blockflow Generator](https://blockflow.openpatch.org/generator.html) to create a project file.

```md
::::blockflow-editor{project="https://example.com/tutorial.json"}
::::
```

When `project` is set, all other configuration attributes (`title`, `src`, `allowExtensions`, `categories`, `blocks-*`) and `:::step` children are ignored.

### Editor Arguments

- **title**: The title of the tutorial.
- **src**: The path or URL to the `.sb3` Scratch project file.
- **project**: URL to a `.json` project file. When set, inline configuration is ignored.
- **width**: The width of the editor. Defaults to `100%`.
- **height**: The height of the editor. Defaults to `700px`.
- **allowExtensions**: Allow Scratch extensions (`"true"` or `"false"`).
- **showCostumesTab**: Show or hide the Costumes/Backdrops tab (`"true"` or `"false"`).
- **showSoundsTab**: Show or hide the Sounds tab (`"true"` or `"false"`).
- **categories**: Comma-separated list of toolbox categories.
- **blocks-\<category\>**: Comma-separated list of blocks for a category.
