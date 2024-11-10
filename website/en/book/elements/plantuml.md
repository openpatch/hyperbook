---
name: PlantUML
permaid: plantuml
---

[PlantUML](https://www.plantuml.com/) lets you create diagrams and
visualizations using text and code. Unlike the [Mermaid](/elements/mermaid)
element, this element requires the external service Kroki for rendering the
diagrams.

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

The PlantUML element accepts these arguments:

- **width**: The width of the diagram.
- **alt**: An alternative text for the diagram.
