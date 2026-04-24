# Windows Packaging

This packaging target wraps the web application in Electron.

## Layout

- `src/` contains the Electron main process code
- `runtime/` is generated and bundled by Electron Builder
- `scripts/prepare-runtime.mjs` copies the built frontend and the Express server into `runtime/`

## Build

From the repository root:

```bash
npm install --prefix packaging/windows
npm run prepare:windows-runtime
npm run package:windows
```

## Runtime Storage

The Electron shell redirects `MACROEDITOR_DATA_DIR` into the app user data folder so documents and macros are not written into the installation directory.
