# Project Context – MacroEditor

## Overview
MacroEditor is a **semantic macro‑oriented text editor** offering two fully‑featured applications:
- A **desktop GTK4** client written in Python.
- A **web client** built with React (frontend) and Express (backend).

The repository also contains Windows packaging (Electron wrapper) and Debian packaging for the GTK version.

## Core Features
- Standard editor capabilities (new, open, save, undo/redo, line numbers, status bar).
- **Column mode** – rectangular selection, vertical extension, block cut/copy/paste.
- **Macro recording** – captures typed text, deletions, cursor moves, mouse clicks; stored as JSON and replayable with repetitions.
- **Search** – plain, replace, regex assistant, advanced manual regex with flags.
- **Web UI** – dark/light theme, built‑in help, backend for persisting documents and macros.

## Directory Structure
```
MacroEditor/
├─ app.py                 # Entry point for the GTK desktop app
├─ main.py                # Launch script for the desktop version
├─ editor/                # Core editor logic (text editor, macro recorder, column selection)
├─ macros/                # Macro model, storage and player
├─ ui/                    # GTK UI components (main window, toolbar, status bar)
├─ utils/                 # Helper utilities (GTK wrappers, encoding helpers)
├─ server/                # Express backend (documents & macros storage)
├─ web/                   # React frontend (src/, vite config, assets)
├─ packaging/             # Debian and Windows packaging scripts
└─ docs/                  # Media assets (demo GIF, future videos)
```

## Prerequisites & Installation
### Desktop (GTK)
- Python 3.11+
- PyGObject, GTK 4, GtkSourceView 5
- Linux system
```bash
sudo apt-get update && sudo apt-get install -y \
    python3-gi gir1.2-gtk-4.0 gir1.2-gtksource-5
python3 main.py
```
### Web (React + Express)
- Node.js 20+, npm 10+
```bash
cd web
npm install
npm run dev:web        # start frontend
npm run start:server   # start backend (in another terminal)
# Open http://localhost:5173
```
### Build
```bash
npm run build:web      # produces production assets in web/dist
```
### Packaging
- **Debian**: `npm run package:debian -- <version>` creates `dist/macroeditor_<ver>_all.deb`.
- **Windows**: Uses the compiled web assets inside an Electron wrapper (see `packaging/windows/`).

## Data Storage
- Desktop: macros and documents are persisted as JSON files (paths defined in the code).
- Web backend stores runtime data under `server/data/documents/` and `server/data/macros/` (both contain a `.gitkeep` placeholder and are **not** version‑controlled).

## Development Tips
- Run the Python desktop app via `python3 main.py`.
- For the web stack, keep the backend and frontend processes running in separate terminals.
- Use the provided demo GIF (`docs/media/macroeditor-demo.gif`) for visual reference.
- Follow the packaging scripts under `packaging/` when creating release artefacts.

---
*This file consolidates the essential information needed to work on MacroEditor efficiently.*
