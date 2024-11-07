---
name: EduGit Pages
lang: de
---

# Auf EduGit Page bereitstellen

## Repository vorbereiten

Du musst CI/CD für dein Repository aktivieren. Dazu gehe zu Settings/General und aktiviere CI/CD.

EduGit Pages funktioniert nur für Branches, in die Entwickler pushen dürfen, da
der Pipeline Benutzer nur Entwicklerrechte besitzt. Dazu gehe zu
Settings/Repository/Protected branches und erlaube mindestes Entwicklern das
Pushen zur main-Branch. Du kannst auch einfach die main-Branch ungeschützt lassen.

## CI/CD Pipeline Konfiguration

:::alert{warn}
Denke daran den basePath in deiner [Konfiguration](/configuration/book) zu
setzen, when du dein Hyperbook auf EduGit bereitstellst.
:::

```yml
image: node:latest

pages:
  stage: deploy
  script:
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

Beispiel-Repository: https://edugit.org/mikebarkmin/hyperbook-edugit-pages
