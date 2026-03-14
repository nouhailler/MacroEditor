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

To build the package from the repository:

```bash
./debian/build.sh 0.2.0
```

The package will be generated in:

```text
dist/macroeditor_0.2.0_all.deb
```
