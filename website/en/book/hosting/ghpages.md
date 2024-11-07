---
name: GitHub Pages
---

# Deploy on GitHub Pages

:::alert{warn}
Remember to add a basePath to your [configuration](/configuration/book), when deploying to GitHub pages.
:::

For GitHub Pages you can use the following action:

```yaml
name: GitHub Pages

on:
  push:
    branches:
      - main # Set a branch name to trigger deployment
  pull_request:

jobs:
  deploy:
    runs-on: ubuntu-20.04
    concurrency:
      group: ${{ github.workflow }}-${{ github.ref }}
    steps:
      - uses: actions/checkout@v2

      - name: Build
        run: |
          npx hyperbook build

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        if: ${{ github.ref == 'refs/heads/main' }}
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./.hyperbook/out
```

Example Repository: https://github.com/mikebarkmin/hyperbook-github-pages/

:::alert{warn}
Do not forget to pick a source branch in the GitHub pages settings
:::
