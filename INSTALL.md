# Installation

## Prerequisites

On Debian 13 or compatible systems, install the runtime dependencies first:

```bash
sudo apt-get update
sudo apt-get install -y python3 python3-gi gir1.2-gtk-4.0 gir1.2-gtksource-5
```

## Install The `.deb`

From the project release assets or local `dist/` directory:

```bash
sudo dpkg -i macroeditor_0.2.0_all.deb
```

If `dpkg` reports missing dependencies, fix them with:

```bash
sudo apt-get install -f
```

## Launch

You can launch MacroEditor either from the applications menu or from a terminal:

```bash
macroeditor
```

## Build Locally

To build the Debian package from the repository:

```bash
npm run package:debian -- 0.2.0
```

The package will be generated in:

```text
dist/macroeditor_0.2.0_all.deb
```

## Windows Package

The Windows package is based on the web version embedded in an Electron shell.

The recommended release path is now GitHub Actions on a Windows runner:

- pushing a `vX.Y.Z` tag builds the Windows and Debian packages on GitHub-hosted runners
- the workflow uploads the `.exe` and `.deb` assets to the matching GitHub Release
- manual workflow runs can build validation artifacts without publishing a release

Install the Windows packaging dependencies:

```bash
npm install --prefix packaging/windows
```

Prepare the embedded runtime:

```bash
npm run prepare:windows-runtime
```

Build the Windows package:

```bash
npm run package:windows
```

The generated artifacts will be placed in:

```text
dist/windows/
```
