# Hyperbook

<!-- hy-mt2-i18n:start -->
[English](./README.md) | **中文** | [日本語](./README_ja.md) | [Español](./README_es.md)
<!-- hy-mt2-i18n:end -->


Hyperbook 是一种快速简便的方式，可用于构建支持现代标准且运行速度极快的交互式工作簿。

- **文档**：https://hyperbook.openpatch.org
- **仓库**：https://github.com/openpatch/hyperbook
- **社区**：https://matrix.to/#/#openpatch:matrix.org

## 包

该单仓库包含以下包：

### 核心包

- **[hyperbook](packages/hyperbook)** - 用于创建、构建及托管 Hyperbook 项目的核心命令行工具
- **[@hyperbook/markdown](packages/markdown)** - 拥有 30 多种自定义指令的 Markdown 处理引擎
- **[@hyperbook/fs](packages/fs)** - 用于管理 Hyperbook 项目的文件系统工具
- **[@hyperbook/types](packages/types)** - 面向 Hyperbook 生态系统的 TypeScript 类型定义
- **[create-hyperbook](packages/create)** - 用于搭建新 Hyperbook 项目的交互式命令行工具

### 组件

- **[@hyperbook/web-component-excalidraw](packages/web-component-excalidraw)** - 用于绘制图表的 Excalidraw 网络组件

### 平台

- **[hyperbook-studio](platforms/vscode)** - 提供预览、代码片段及验证功能的 Visual Studio Code 扩展

## 文档

如果您想参与文档编写，可启动开发服务器并编辑网站文件夹中的文件。

```
pnpm install
pnpm build
pnpm website:dev
```

## VSCode 扩展

如果您想开发 VSCode 扩展：

```
pnpm install
pnpm build
pnpm --filter hyperbook-studio watch
pnpm --filter hyperbook-studio open
```

## 维护者

Mike Barkmin • [Mastodon](https://bildung.social/@mikebarkmin) • [GitHub](https://github.com/mikebarkmin/)

## 支持

如果您需要针对您的应用获得定制化支持或功能，我们[很乐意与您联系](mailto:contact@openpatch.org)。

---

Hyperbook 由致力于教育评估与培训的 [OpenPatch](https://openpatch.org) 维护。如果您需要帮助，或者您自己创建了 Hyperbook，[请与我们取得联系](mailto:contact@openpatch.org)。
