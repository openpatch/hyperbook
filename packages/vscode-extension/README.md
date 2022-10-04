# VSCode Hyperbook Extension

## Development

Install dependencies first.

```bash
$ npm install
```

After the install process you can press `F5` to "Start Debugging" (or: select in menu **"Debug" -> "Run Extension"**). A new Extension Development Host window will open in which you need to open command palette (`Ctrl/Cmd + Shift + P`) and select **"Webview React: Open Webview"** to open webview.

## Publish

```
npm install -g vsce
vsce package
vsce publish
```
