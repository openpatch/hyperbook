# Hyperbook

<!-- hy-mt2-i18n:start -->
[English](./README.md) | [中文](./README_zh-CN.md) | [日本語](./README_ja.md) | **Español**
<!-- hy-mt2-i18n:end -->


Hyperbook es una forma rápida y sencilla de crear cuadernos de trabajo interactivos que
soportan los estándares modernos y funcionan a una velocidad increíble.

- **Documentación**: https://hyperbook.openpatch.org
- **Repositorio**: https://github.com/openpatch/hyperbook
- **Comunidad**: https://matrix.to/#/#openpatch:matrix.org

## Paquetes

Este monorepo contiene los siguientes paquetes:

### Paquetes principales

- **[hyperbook](packages/hyperbook)** - Herramienta CLI principal para crear, compilar y servir proyectos Hyperbook
- **[@hyperbook/markdown](packages/markdown)** - Motor de procesamiento de Markdown con más de 30 directivas personalizadas
- **[@hyperbook/fs](packages/fs)** - Utilidades del sistema de archivos para gestionar proyectos Hyperbook
- **[@hyperbook/types](packages/types)** - Definiciones de tipos de TypeScript para el ecosistema Hyperbook
- **[create-hyperbook](packages/create)** - CLI interactiva para crear estructuras básicas de nuevos proyectos Hyperbook

### Componentes

- **[@hyperbook/web-component-excalidraw](packages/web-component-excalidraw)** - Componente web Excalidraw para diagramas

### Plataformas

- **[hyperbook-studio](platforms/vscode)** - Extensión para Visual Studio Code con vista previa, fragmentos de código y validación

## Documentación

Si deseas trabajar en la documentación, ejecuta el
servidor de desarrollo y edita los archivos en la carpeta del sitio web.

```
pnpm install
pnpm build
pnpm website:dev
```

## Extensión para VSCode

Si quieres trabajar en la extensión para vscode:

```
pnpm install
pnpm build
pnpm --filter hyperbook-studio watch
pnpm --filter hyperbook-studio open
```

## Mantenedor

Mike Barkmin • [Mastodon](https://bildung.social/@mikebarkmin) • [GitHub](https://github.com/mikebarkmin/)

## Soporte

Estamos [encantados de recibir tus comentarios](mailto:contact@openpatch.org) si necesitas soporte personalizado o funcionalidades adicionales para tu aplicación.

---

Hyperbook es mantenido por [OpenPatch](https://openpatch.org), una organización dedicada a las evaluaciones educativas y la formación. Si necesitas ayuda o has creado un Hyperbook, [contáctanos](mailto:contact@openpatch.org).
