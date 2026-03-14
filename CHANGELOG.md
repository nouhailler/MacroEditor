# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog, and this project uses semantic-style version tags.

## [v0.2.0] - 2026-03-14

### Added

- Debian package structure for distributing MacroEditor as a `.deb`.
- Package metadata in `debian/control`.
- Post-installation script for desktop database and icon cache refresh.
- Desktop menu entry for launching MacroEditor from Linux application menus.
- Application launcher installed as `macroeditor`.
- SVG application icon for desktop integration.
- `INSTALL.md` with simplified installation and build instructions.
- Build script to produce `dist/macroeditor_0.2.0_all.deb`.

## [v0.1.0] - 2026-03-14

### Added

- Initial MVP release of MacroEditor.
- GTK4 desktop application written in Python.
- Text editor based on GtkSourceView with line numbers.
- File operations: new, open, save, save as.
- Standard editing actions: copy, cut, paste, undo, redo.
- Semantic macro recording using editor commands instead of raw keycodes.
- Macro playback with repeat count support.
- JSON macro persistence in `~/.config/macroeditor/macros/`.
- Automatic macro loading at startup.
- Text search with `Ctrl+F`.
- Replace next and replace all with result count using `Ctrl+H`.
- Status bar showing cursor position, encoding, and macro state.
- Project documentation with GitHub-ready README.
- MIT license.
