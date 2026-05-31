---
name: PlantUML
permaid: plantuml
---

:::alert{warning}
**Requires a network connection.** Diagrams are rendered server-side by the [Kroki](https://kroki.io/) service (`kroki.io`) at build/render time. Kroki is not bundled with the hyperbook build output. This element will not work if Kroki is unreachable. Kroki is open source and can be [self-hosted](https://docs.kroki.io/kroki/setup/install/) for air-gapped deployments.
:::

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
