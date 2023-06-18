---
name: PlantUML
lang: de
---

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
