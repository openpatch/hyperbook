---
name: GitLab Pages
lang: de
---

# Deploy on GitLab Pages

:::alert{warn}
Denke daran den basePath in deiner [Konfiguration](/configuration/book) zu
setzen, when du dein Hyperbook auf GitLab bereitstellst.
:::

```yml
image: node:latest

pages:
  stage: deploy
  script:
    - npx hyperbook setup
    - npx hyperbook build
    - mkdir .public
    - cp -r ./.hyperbook/out/* .public
    - rm -rf public
    - mv .public public
  artifacts:
    paths:
      - public
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

Beispiel-Repository: https://gitlab.com/mikebarkmin/hyperbook-gitlab-pages
