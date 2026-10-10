# Safari Web Annotator & Highlighter

A lightweight Manifest V3 Safari Web Extension to highlight text, draw, and annotate directly on web pages with persistent storage.

---

## Features

- **Text Highlighting**: Select text and apply custom colored highlights.
- **In-Page Drawing**: Freehand drawing tools with brush size and color pickers.
- **Persistent Annotations**: Automatically preserves highlights and notes across page visits using extension storage.
- **Snapshot Export**: Export annotated web pages as PNG images.
- **Keyboard Shortcuts**:
  - `Alt + Shift + A`: Toggle Annotator Toolbar
  - `Alt + Shift + H`: Toggle Highlighter
  - `Alt + Shift + D`: Toggle Drawing Mode
  - `Command + Shift + S`: Save Annotations
  - `Command + Shift + E`: Export Snapshot PNG
  - `Command + Shift + X`: Clear Page Annotations

---

## Installation in Safari

1. Enable **Develop > Allow Unsigned Extensions** in Safari.
2. Build or convert using Xcode:
   ```bash
   xcrun safari-web-extension-converter /path/to/safari-highlighter-extension --macos-only
   ```
3. Enable **Safari Web Annotator** in **Safari > Settings > Extensions**.

---

## License

MIT License.
