<p align="center">
  <img src="icons/icon-128.png" width="128" height="128" alt="Safari Web Annotator Logo">
</p>

<h1 align="center">Safari Web Annotator & Highlighter</h1>

<p align="center">
  <b>A responsive Manifest V3 Safari extension to highlight text, sketch freehand, draw geometric annotations, and export notes directly on any webpage.</b>
</p>

<p align="center">
  <a href="#features"><img src="https://img.shields.io/badge/Platform-macOS%20Safari-007AFF.svg?style=flat-square&logo=apple&logoColor=white" alt="Platform"></a>
  <a href="#features"><img src="https://img.shields.io/badge/Manifest-V3-34C759.svg?style=flat-square" alt="Manifest V3"></a>
  <a href="#features"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License"></a>
  <a href="#features"><img src="https://img.shields.io/badge/Storage-Persistent%20Local-7B2CBF.svg?style=flat-square" alt="Storage"></a>
  <a href="#features"><img src="https://img.shields.io/badge/Export-PNG%20Snapshots-FFB703.svg?style=flat-square" alt="Export"></a>
</p>

---

## Table of Contents

- [General Concept](#general-concept)
- [Key Features](#key-features)
  - [Rich Multi-Color Highlighting](#1-rich-multi-color-text-highlighting)
  - [Freehand Pen & Canvas Drawing](#2-freehand-pen--canvas-drawing)
  - [Persistent Storage Across Sessions](#3-persistent-in-browser-storage)
  - [One-Click PNG Snapshot Export](#4-one-click-png-snapshot-export)
  - [Keyboard-First Workflow](#5-keyboard-first-workflow)
- [Architecture & Design](#architecture--design)
- [One-Click Automated Installation](#one-click-automated-installation)
- [Manual Installation in Safari](#manual-installation-in-safari)
- [Keyboard Shortcuts Reference](#keyboard-shortcuts-reference)
- [Testing](#testing)
- [Contributing & License](#contributing--license)

---

## General Concept

Reading dense technical documentation, academic papers, lecture transcripts, and web articles in Safari often requires active reading tools: highlighting critical arguments, circling key figures, and taking contextual margins notes.

**Safari Web Annotator** brings an Apple-inspired floating creative toolbar directly into Safari web pages:
- Highlights survive tab closures and page reloads.
- Smooth drawing canvas overlays without breaking web page responsiveness or links.
- Instant PNG snapshots capture your markups alongside the page content for sharing or study notes.

---

## Key Features

### 1. Rich Multi-Color Text Highlighting
- Select any text on a page to apply smooth translucent highlight ribbons.
- Multiple Apple palette presets (Neon Yellow, Coral Red, Sky Blue, Lime Green, Lavender).
- Click any active highlight to remove it or change color.

### 2. Freehand Pen & Canvas Drawing
- Toggle a full-viewport transparent HTML5 canvas overlay.
- Smooth Bézier curve interpolation for natural Apple Pencil / trackpad stylus drawing.
- Adjustable stroke widths (Fine, Medium, Marker, Calligraphy).

### 3. Persistent In-Browser Storage
- Highlights and annotations are serialized and indexed by the page's canonical URL via `chrome.storage.local`.
- When returning to a previously marked article, your highlights are automatically re-applied to the DOM.

### 4. One-Click PNG Snapshot Export
- Flatten your drawings and page annotations into high-resolution PNG images.
- Ideal for compiling study cheatsheets or sharing feedback with colleagues.

### 5. Keyboard-First Workflow
- Complete keyboard accessibility with native macOS shortcuts (`Alt + Shift + A`, `Alt + Shift + H`, `Alt + Shift + D`).

---

## Architecture & Design

```text
safari-highlighter-extension/
├── manifest.json       # Manifest V3 definitions, permissions, shortcut commands
├── background.js       # Background message router & badge controller
├── icons/              # Creative Sunset-Violet vector & multi-res PNG icons
│   ├── logo.svg
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   ├── icon-128.png
│   └── icon-512.png
├── content/
│   ├── content.js      # Main coordinator
│   ├── highlighter.js  # DOM selection range extractor & highlight span builder
│   ├── drawer.js       # HTML5 canvas overlay & Bézier curve renderer
│   ├── toolbar.js      # Floating draggable Apple-style HUD toolbar
│   └── storage.js      # Chrome storage manager
├── test/
│   └── test-page.html  # Interactive test harness
├── install.sh          # One-click automated setup script
├── open-in-safari.sh   # Instant launcher
└── reload-safari.sh    # Instant Safari tab reloader
```

---

## One-Click Automated Installation

A setup script is included in the root directory that configures Safari's developer settings, installs the extension files, and launches the verification environment.

### Run in Terminal:
```bash
curl -fsSL https://raw.githubusercontent.com/Beccaceci/safari-highlighter-extension/main/install.sh | bash
```
*Or locally after cloning:*
```bash
git clone git@github-beccaceci:Beccaceci/safari-highlighter-extension.git
cd safari-highlighter-extension
./install.sh
```

**What the installer does automatically:**
1. Configures Safari developer flags via macOS `defaults`:
   - `IncludeDevelopMenu = true`
   - `WebKitDeveloperExtrasEnabledPreferenceKey = true`
2. Copies files to `~/Library/Application Support/SafariWebAnnotator`.
3. Opens Safari directly with the interactive test page.
4. Walks you through the two quick toggles in Safari.

---

## Manual Installation in Safari

1. **Enable Developer Menu**:
   - Go to **Safari > Settings (⌘,) > Advanced**.
   - Check **"Show features for web developers"** (or "Show Develop menu").
2. **Allow Unsigned Extensions**:
   - In the menu bar, open **Develop > Allow Unsigned Extensions** (enter password).
3. **Turn on the Extension**:
   - In **Safari > Settings > Extensions**, check **Safari Web Annotator**.

---

## Keyboard Shortcuts Reference

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd> | **Toggle Toolbar** | Shows or hides the floating annotation panel |
| <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd> | **Toggle Highlighter** | Switches into text highlight mode |
| <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd> | **Toggle Drawing** | Toggles freehand pen canvas overlay |
| <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> | **Save Page** | Persists current annotations to storage |
| <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>E</kbd> | **Export Snapshot** | Downloads canvas snapshot PNG |
| <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>X</kbd> | **Clear Page** | Clears all markups on the current page |

---

## Testing

Launch the included test page anytime:
```bash
./open-in-safari.sh
```
Or reload all open Safari tabs after making code edits:
```bash
./reload-safari.sh
```

---

## Contributing & License

Contributions, improvements, and feedback are welcome!

Licensed under the **MIT License**.
