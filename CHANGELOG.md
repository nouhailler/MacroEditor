# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog, and this project uses semantic-style version tags.

## [Unreleased]

### Added

- Windows packaging scaffold based on the React and Express application, isolated in `packaging/windows/`.
- GitHub Actions workflow building Windows and Debian release assets and publishing them on version tags.

### Changed

- Packaging layout split into `packaging/debian/` and `packaging/windows/`.
- Web server refactored so it can run either standalone or embedded inside a desktop wrapper.
- Web data storage can now be redirected with `MACROEDITOR_DATA_DIR`, which is required for desktop packaging.
- Windows package version can now be synchronized from the release tag during CI builds.

## [v0.3.1] - 2026-04-23

### Added

- Animated demo GIF generated from the live React application and embedded in the README.
- GNOME-friendly desktop launcher file named `io.github.nouhailler.macroeditor.desktop`.

### Changed

- GTK application id aligned with the desktop launcher for cleaner GNOME integration.
- Debian packaging updated to install the renamed desktop entry.

## [v0.3.0] - 2026-04-23

### Added

- React frontend with document management, toolbar, status bar, import/export, and integrated help dialog.
- Express backend for document and macro persistence.
- Column mode with rectangular selection, keyboard extension, clipboard support, and history restoration.
- Semantic macro improvements for vertical cursor movement and mouse-based cursor repositioning.
- Assisted regex mode, manual regex mode, and regex copy helper.
- Theme switcher with dark and light appearance modes.
- Updated project documentation for GTK desktop and React/Express web variants.

## [v0.2.0] - 2026-03-14

### Added

- Debian package structure for distributing MacroEditor as a `.deb`.
- Package metadata in `packaging/debian/control`.
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
