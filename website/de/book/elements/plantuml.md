---
name: PlantUML
lang: de
---

:::alert{warning}
**Erfordert eine Netzwerkverbindung.** Diagramme werden serverseitig durch den [Kroki](https://kroki.io/)-Dienst (`kroki.io`) gerendert. Kroki ist nicht im Hyperbook-Build-Output enthalten. Dieses Element funktioniert nicht, wenn Kroki nicht erreichbar ist. Kroki ist Open Source und kann für netzwerkisolierte Deployments [selbst gehostet](https://docs.kroki.io/kroki/setup/install/) werden.
:::

Mit [PlantUML] (https://www.plantuml.com/) können Sie Diagramme und
Visualisierungen mit Text und Code erstellen. Anders als das [Mermaid](/elements/mermaid)
Element benötigt dieses Element den externen Dienst Kroki für das Rendering der
Diagramme.

```markdown
:::plantuml
@startuml
Bob -> Alice : hello
@enduml
:::
```

:::plantuml
@startuml
Bob -> Alice : hello
@enduml
:::

Das PlantUML-Element akzeptiert die folgenden Argumente:

- **width**: Die Breite des Diagramms.
- **alt**: Ein alternativer Text für das Diagramm.
