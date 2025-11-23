---
name: Getting Started
index: 0
---

# Hyperbook

Hyperbook is a quick and easy way to build interactive workbooks, that
support modern standards and run superfast. It works by compiling
markdown to static pages.

Hyperbook makes writing interactive workbooks super simple while providing a
good feature set.

You do not need any coding experience. You only need to create and edit Markdown files.

## Getting Started

You can start working on a Hyperbook in three different ways. Choose the one which suits your style best.

:::::tabs{id="options"}

:::tab{title="VS Code" id="vscode"}

1. Install [VS Code](https://code.visualstudio.com/) or [VS Codium](https://vscodium.com/)
1. Install the Hyperbook Extension for [VS Code](https://marketplace.visualstudio.com/items?itemName=openpatch.hyperbook-studio) or [VS Codium](https://open-vsx.org/extension/openpatch/hyperbook-studio)
1. Download the [hyperbook-anywhere](https://github.com/openpatch/hyperbook-anywhere/archive/refs/heads/main.zip) starter
1. Unzip the file
1. Open the folder in VS Code
1. Run the `Hyperbook: Show side preview` command

:::

:::tab{title="CLI" id="cli"}

You need to have [Node](https://nodejs.org/) version 16 or higher installed on your system.

1. Run `npm create hyperbook` and follow the wizard to create your first Hyperbook.
1. Run `npx hyperbook dev` to start the development server.
1. Visit https://localhost:8080 with your favorite web browser.
1. Modify or add new pages to your Hyperbook by using your favorite editor.

:::

::::tab{title="Web IDE" id="web-ide"}

Most platforms for collaborative version control have an integrated Web IDE like [GitLab](https://docs.gitlab.com/ee/user/project/web_ide/) or [GitHub](https://docs.github.com/en/codespaces/the-githubdev-web-based-editor).

So you can just fork one of our starters and get going:

- GitHub: https://github.com/mikebarkmin/hyperbook-github-pages/fork
- GitLab: https://gitlab.com/mikebarkmin/hyperbook-gitlab-pages/-/forks/new
- EduGit: https://edugit.org/mikebarkmin/hyperbook-edugit-pages/-/forks/new

:::alert{warn}

If you use this approach you will not be able to see a representative preview. In most cases only a normal Markdown preview, which lacks some features of Hyperbook.

:::

::::

:::::

## Deploy

The main goal of writing a Hyperbook is to have an interactive workbook. For this you have to deploy the exported Hyperbook to a host.

Luckily GitHub Pages, GitLab Pages and Vercel are free to use options, which are already setup for you, if you used one of our starters, like [hyperbook-anywhere](https://github.com/openpatch/hyperbook-anywhere).

You just have to push your files to [GitHub](https://github.com), [GitLab](https://gitlab.com) or [EduGit](edugit.org/).

If you use the CLI version you can also export your Hyperbook to static HTML files, which can be uploaded anywhere. For this you need to run:

```
npx hyperbook build
```

Then you need to copy the files from `.hyperbook/out` to your desired location.

:::alert{warn}

Do not forget to set a `basePath` in your hyperbook.json.

:::

## Update

::::tabs{id="options"}

:::tab{title="VS Code" id="vscode"}

Updates should happen automatically.

:::

:::tab{title="CLI" id="cli"}

Update to the latest release of Hyperbook CLI using the following command.

```bash
npm update hyperbook --global
```

:::

:::tab{title="Web IDE" id="web-ide"}

No Integration. No updates.

:::

::::

## Support

We are [happy to hear from you](mailto:contact@openpatch.org), if you need custom support or features for your application.

You can also join our [Matrix Channel](https://matrix.to/#/#hyperbook:matrix.org) or connect with us on [Twitter](https://twitter.com/openpatchorg).

---

Hyperbook is maintained by [OpenPatch](https://openpatch.org), an organization for educational assessments and training. If you need help or create a Hyperbook [get in touch](mailto:contact@openpatch.org).
