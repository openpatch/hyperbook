---
name: GitHub Pages
lang: de
---

# Auf GitHub Pages bereitstellen

:::alert{warn}
Denke daran den basePath in deiner [Konfiguration](/configuration/book) zu
setzen, when du dein Hyperbook auf GitHub bereitstellst.
:::

Für GitHub Pages kannst du den folgenden Workflow verwenden:

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

Beispiel-Repository: https://github.com/mikebarkmin/hyperbook-github-pages/

:::alert{warn}
Vergiss nicht deine Branch als Quelle in den GitHub Pages Einstellungen zu setzen.
:::
