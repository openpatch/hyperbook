---
name: Los Gehts
index: 0
lang: de
---

# Hyperbook

Hyperbook ist eine schnelle und einfache Möglichkeit interaktive Arbeitshefte zu erstellen, die moderne Standards unterstützen und sehr schnell sind. Dazu werden Markdown-Datein in statische HTML-Seiten umgewandelt.

Du brauchst keine Programmiererfahrung. Du brauchst nur Markdown-Dateien erstellen und editieren.

## Los Gehts

Du kannst mit der Erstellung deines Hyperbook auf drei Arten starten. Wähle die Art die am besten zu dir passt.

:::::tabs{id="options"}

:::tab{title="VS Code" id="vscode"}

1. Installiere [VS Code](https://code.visualstudio.com/) oder [VS Codium](https://vscodium.com/)
1. Installiere die Hyperbook Erweiterung für [VS Code](https://marketplace.visualstudio.com/items?itemName=openpatch.hyperbook-studio) oder [VS Codium](https://open-vsx.org/extension/openpatch/hyperbook-studio)
1. Downloade den [hyperbook-anywhere](https://github.com/openpatch/hyperbook-anywhere/archive/refs/heads/main.zip) Starter
1. Entpacke die Datei
1. Öffne den Order in VS Code
1. Führe den Befehl `Hyperbook: Show side preview` aus

:::

:::tab{title="CLI" id="cli"}

Du benötigst [Node](https://nodejs.org/) version 16 oder höherer auf deinen System.

1. Führe `npx hyperbook new my-new-hyperbook` aus und folge den Anweisungen, um dein erstes Hyperbook zu erstellen.
1. Führe `npx hyperbook dev` aus, um den Entwicklungsserver zu starten.
1. Besuche https://localhost:3000 mit deinem Lieblingsbrowser.
1. Modifiziere oder füge neue Seiten zu deinen Hyperbook hinzu mit deinem Lieblingseditor.

:::

::::tab{title="Web IDE" id="web-ide"}

Die meisten Platformen für kollaborative Versionskontrolle haben eine integrierte Web IDE, wie [GitLab](https://docs.gitlab.com/ee/user/project/web_ide/) oder [GitHub](https://docs.github.com/en/codespaces/the-githubdev-web-based-editor).

Du kannst eins der Startprojekte forken und direkt loslegen:

- GitHub: https://github.com/mikebarkmin/hyperbook-github-pages/fork
- GitLab: https://gitlab.com/mikebarkmin/hyperbook-gitlab-pages/-/forks/new
- EduGit: https://edugit.org/mikebarkmin/hyperbook-edugit-pages/-/forks/new

:::alert{warn}

Wenn du diesen Ansatz wählt, wirst du keine repräsentative Vorschau bekommen. In den meisten Fällen bekommst du nur eine normale Markdown-Vorschau, welche manche Features von Hyperbook nicht unterstützt.

:::

::::

:::::

## Bereitstellen

Das Hauptziel des Schreibens eines Hyperbooks ist ein interaktives Arbeitsheft. Dafür muss diese auf einen Server bereitgestellt werden.

Zum Glück sind GitHub Pages, GitLab Pages und Vercel kostenlose Optionen, welche bereits für dich konfiguriert sind, wenn du unseren Starter benutzt hast [hyperbook-anywhere](https://github.com/openpatch/hyperbook-anywhere).

Du musst die Dateien nur zu [GitHub](https://github.com), [GitLab](https://gitlab.com) oder [EduGit](edugit.org/) pushen.

Wenn du die CLI Version verwendet hast, kannst du außerdem dein Hyperbook in statische HTML-Dateien umwandeln, welche du überall hochladen kannst. Dafür musst du den folgenden Befehl ausführen:

```
npx hyperbook build
```

Danach kannst du die Dateien vom Ordner `.hyperbook/out` zum Zielort kopieren.

:::alert{warn}

Vergiss nicht den `basePath` in deiner hyperbook.json zu setzen.

:::

## Update

::::tabs{id="options"}

:::tab{title="VS Code" id="vscode"}

Updates sollten automatisch funktionieren.

:::

:::tab{title="CLI" id="cli"}

Um die neuste Version des Hyperbook CLI zu bekommen, benutzte den folgenden Befehl:

```bash
npm update hyperbook --global
```

Danach update dein Hyperbook mit dem Befehl:

```bash
hyperbook setup
```

:::

:::tab{title="Web IDE" id="web-ide"}

Keine Integration und daher auch keine Updates.

:::

::::

## Unterstützung

Wir [freuen uns von dir zu hören](mailto:contact@openpatch.org), wenn du Unterstützung oder neue Features für deinen Anwendungszweck benötigst.

Du kannst außerdem unserem [Matrix Channel](https://matrix.to/#/#hyperbook:matrix.org) beitreten oder uns auf [Twitter](https://twitter.com/openpatchorg) folgen.

---

Hyperbook is maintained by [OpenPatch](https://openpatch.org), an organization for educational assessments and training. If you need help or create a Hyperbook [get in touch](mailto:contact@openpatch.org).
