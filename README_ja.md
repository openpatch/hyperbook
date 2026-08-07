# Hyperbook

<!-- hy-mt2-i18n:start -->
[English](./README.md) | [中文](./README_zh-CN.md) | **日本語** | [Español](./README_es.md)
<!-- hy-mt2-i18n:end -->


Hyperbookとは、現代の標準をサポートし、非常に高速に動作するインタラクティブなワークブックを簡単かつ迅速に作成できるツールです。

- **ドキュメント**: https://hyperbook.openpatch.org
- **リポジトリ**: https://github.com/openpatch/hyperbook
- **コミュニティ**: https://matrix.to/#/#openpatch:matrix.org

## パッケージ

このモノレポには以下のパッケージが含まれています：

### コアパッケージ

- **[hyperbook](packages/hyperbook)** - Hyperbookプロジェクトの作成、ビルド、サービングを行うメインのCLIツール
- **[@hyperbook/markdown](packages/markdown)** - 30以上のカスタムディレクティブを備えたMarkdown処理エンジン
- **[@hyperbook/fs](packages/fs)** - Hyperbookプロジェクトを管理するためのファイルシステムユーティリティ
- **[@hyperbook/types](packages/types)** - Hyperbookエコシステム向けのTypeScript型定義
- **[create-hyperbook](packages/create)** - 新しいHyperbookプロジェクトのスケルトンを作成するためのインタラクティブCLI

### コンポーネント

- **[@hyperbook/web-component-excalidraw](packages/web-component-excalidraw)** - 図表作成用のExcalidrawウェブコンポーネント

### プラットフォーム

- **[hyperbook-studio](platforms/vscode)** - プレビューやスニペット、検証機能を備えたVisual Studio Code拡張機能

## ドキュメントの編集

ドキュメントの編集を行いたい場合は、開発サーバーを起動し、websiteフォルダ内のファイルを編集してください。

```
pnpm install
pnpm build
pnpm website:dev
```

## VSCode拡張機能の編集

VSCode拡張機能の編集を行いたい場合は：

```
pnpm install
pnpm build
pnpm --filter hyperbook-studio watch
pnpm --filter hyperbook-studio open
```

## メンテナー

Mike Barkmin • [Mastodon](https://bildung.social/@mikebarkmin) • [GitHub](https://github.com/mikebarkmin/)

## サポート

アプリケーションにカスタムサポートや機能が必要な場合は、ぜひ[ご連絡ください](mailto:contact@openpatch.org)。お気軽にお知らせください。

---

Hyperbookは、教育評価およびトレーニングを手掛ける組織である[OpenPatch](https://openpatch.org)によってメンテナンスされています。何かお困りの際やHyperbookを作成した場合は、[ご連絡ください](mailto:contact@openpatch.org)。
