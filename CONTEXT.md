# Context

Last updated: 2026-04-24

## Current Git State

- Current branch: `release-infra-v0.3.2`
- Current HEAD: `15ac937`
- Tag `v0.3.2` points to `15ac937`
- Branch `release-infra-v0.3.2` has been pushed to `origin`
- Tag `v0.3.2` has been pushed to `origin`
- Local worktree is clean for MacroEditor changes
- Remaining local untracked path: `syscontrolor/` (intentionally left out of the MacroEditor commit scope)

## What Was Added

- Windows packaging based on Electron was added under `packaging/windows/`
- Debian packaging was moved from `debian/` to `packaging/debian/`
- A GitHub Actions release workflow was added in `.github/workflows/windows-release.yml`
- Documentation was updated in `README.md`, `INSTALL.md`, and `CHANGELOG.md`

## Packaging Layout

- `packaging/debian/`
  - Debian `.deb` packaging for the GTK desktop application
- `packaging/windows/`
  - Electron wrapper for the web application
  - includes:
    - `src/main.cjs`
    - `scripts/prepare-runtime.mjs`
    - `scripts/set-version.mjs`
    - `package.json`
    - `package-lock.json`

## Server Refactor

The Express backend was refactored so it can run in two modes:

- standalone server mode
- embedded mode inside the Electron Windows wrapper

Main changes:

- `server/src/index.js`
  - now exports `startServer(...)`
- `server/src/app.js`
  - new file containing the Express app factory
- `server/src/storage.js`
  - supports `MACROEDITOR_DATA_DIR`

This refactor is required so the Windows package can:

- launch a local Express server dynamically
- serve the built React frontend from the packaged runtime
- store documents/macros in the user profile instead of the install directory

## Root NPM Scripts

The root `package.json` now exposes:

- `npm run build:web`
- `npm run prepare:windows-runtime`
- `npm run package:windows`
- `npm run package:debian`

## Windows Packaging Flow

Local flow:

1. `npm install --prefix packaging/windows`
2. `npm run prepare:windows-runtime`
3. `npm run package:windows`

What `prepare:windows-runtime` does:

- builds the React frontend
- copies `web/dist` into `packaging/windows/runtime/web-dist`
- copies the server source into `packaging/windows/runtime/server`

Known local Debian result:

- local Windows packaging from Debian was tested
- it works up to Electron packaging
- it fails at the installer/signing stage because `wine` is missing
- `dist/windows/win-unpacked/` was generated locally during testing

Conclusion:

- cross-build from Debian is partially viable
- the robust release path should be GitHub Actions on `windows-latest`

## Release Workflow

Workflow file:

- `.github/workflows/windows-release.yml`

Workflow behavior:

- trigger on git tags matching `v*`
- also supports `workflow_dispatch`
- resolves the release version
- builds Windows artifacts on `windows-latest`
- builds Debian artifacts on `ubuntu-latest`
- uploads workflow artifacts
- publishes Windows and Debian assets to the same GitHub Release for tag builds

Jobs currently defined:

- `resolve-version`
- `build-windows`
- `build-debian`
- `publish-release`

Version handling:

- `packaging/windows/scripts/set-version.mjs` updates the Windows package version from the release tag
- this keeps `packaging/windows/package.json` and its lockfile aligned with the tag version during CI

## Local Validation Performed

Validated successfully:

- `npm run build:web`
- `npm run prepare:windows-runtime`
- `npm run package:debian -- 0.3.1`
- `npm run package:debian -- 0.3.2`
- `node packaging/windows/scripts/set-version.mjs v0.3.1`

Partially validated:

- `npm run package:windows`
  - passed until Electron needed `wine` on Debian

## Important Files To Review First On Resume

- [package.json](/home/homardsheriff/codex-workspace/macroeditor/package.json:1)
- [server/src/index.js](/home/homardsheriff/codex-workspace/macroeditor/server/src/index.js:1)
- [server/src/app.js](/home/homardsheriff/codex-workspace/macroeditor/server/src/app.js:1)
- [server/src/storage.js](/home/homardsheriff/codex-workspace/macroeditor/server/src/storage.js:1)
- [packaging/debian/build.sh](/home/homardsheriff/codex-workspace/macroeditor/packaging/debian/build.sh:1)
- [packaging/windows/package.json](/home/homardsheriff/codex-workspace/macroeditor/packaging/windows/package.json:1)
- [packaging/windows/src/main.cjs](/home/homardsheriff/codex-workspace/macroeditor/packaging/windows/src/main.cjs:1)
- [packaging/windows/scripts/prepare-runtime.mjs](/home/homardsheriff/codex-workspace/macroeditor/packaging/windows/scripts/prepare-runtime.mjs:1)
- [packaging/windows/scripts/set-version.mjs](/home/homardsheriff/codex-workspace/macroeditor/packaging/windows/scripts/set-version.mjs:1)
- [.github/workflows/windows-release.yml](/home/homardsheriff/codex-workspace/macroeditor/.github/workflows/windows-release.yml:1)
- [README.md](/home/homardsheriff/codex-workspace/macroeditor/README.md:1)
- [INSTALL.md](/home/homardsheriff/codex-workspace/macroeditor/INSTALL.md:1)
- [CHANGELOG.md](/home/homardsheriff/codex-workspace/macroeditor/CHANGELOG.md:1)

## Known Open Points

- GitHub Actions execution was triggered by pushing `v0.3.2`, but the run status was not confirmed locally
- local `gh` auth is currently invalid on this machine, so GitHub CLI could not be used to inspect Actions or Releases
- Windows code signing was not configured or validated during this session
- `packaging/windows` currently uses the default Electron icon if no build resources are added

## Recommended Next Steps

1. Confirm the GitHub Actions runs for tag `v0.3.2`
2. Verify that the GitHub Release contains both:
   - Windows `.exe` assets
   - Debian `.deb` asset
3. If Windows packaging succeeds, test the produced installer and portable build on a real Windows machine
4. Decide whether Windows signing should be configured through GitHub secrets:
   - `CSC_LINK`
   - `CSC_KEY_PASSWORD`
5. Add proper Windows application icons under `packaging/windows/assets/` if a branded installer is needed
