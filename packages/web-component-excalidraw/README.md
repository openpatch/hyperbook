# @hyperbook/web-component-excalidraw

Web component wrapper for Excalidraw integration in Hyperbook. This package provides a custom element that embeds the Excalidraw drawing tool as a reusable web component.

**Features:**
- Standalone Excalidraw web component
- Built with React and converted to web component via `@r2wc/react-to-web-component`
- Compatible with any HTML environment
- Used by the `:excalidraw` directive in `@hyperbook/markdown`

## Installation

```sh
pnpm add @hyperbook/web-component-excalidraw
# or
npm i @hyperbook/web-component-excalidraw
```

## Usage

```html
<!-- In HTML -->
<hyperbook-excalidraw data="..."></hyperbook-excalidraw>
```

```javascript
// In JavaScript
import "@hyperbook/web-component-excalidraw";
```
