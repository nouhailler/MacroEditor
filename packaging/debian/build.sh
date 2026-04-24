#!/bin/bash
set -euo pipefail

VERSION="${1:-0.2.0}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PACKAGING_DIR="${ROOT_DIR}/packaging/debian"
BUILD_DIR="${ROOT_DIR}/dist/deb-build"
PACKAGE_DIR="${BUILD_DIR}/macroeditor_${VERSION}_all"
OUTPUT_FILE="${ROOT_DIR}/dist/macroeditor_${VERSION}_all.deb"

rm -rf "${PACKAGE_DIR}"
mkdir -p "${PACKAGE_DIR}/DEBIAN"
mkdir -p "${PACKAGE_DIR}/opt/macroeditor"
mkdir -p "${PACKAGE_DIR}/usr/bin"
mkdir -p "${PACKAGE_DIR}/usr/share/applications"
mkdir -p "${PACKAGE_DIR}/usr/share/icons/hicolor/scalable/apps"
mkdir -p "${ROOT_DIR}/dist"

sed "s/@VERSION@/${VERSION}/g" "${PACKAGING_DIR}/control" > "${PACKAGE_DIR}/DEBIAN/control"
install -m 755 "${PACKAGING_DIR}/postinst" "${PACKAGE_DIR}/DEBIAN/postinst"
install -m 755 "${PACKAGING_DIR}/macroeditor" "${PACKAGE_DIR}/usr/bin/macroeditor"
install -m 644 "${PACKAGING_DIR}/io.github.nouhailler.macroeditor.desktop" "${PACKAGE_DIR}/usr/share/applications/io.github.nouhailler.macroeditor.desktop"
install -m 644 "${PACKAGING_DIR}/macroeditor.svg" "${PACKAGE_DIR}/usr/share/icons/hicolor/scalable/apps/macroeditor.svg"
install -m 644 "${ROOT_DIR}/README.md" "${PACKAGE_DIR}/opt/macroeditor/README.md"
install -m 644 "${ROOT_DIR}/LICENSE" "${PACKAGE_DIR}/opt/macroeditor/LICENSE"
install -m 644 "${ROOT_DIR}/CHANGELOG.md" "${PACKAGE_DIR}/opt/macroeditor/CHANGELOG.md"
install -m 644 "${ROOT_DIR}/main.py" "${PACKAGE_DIR}/opt/macroeditor/main.py"
install -m 644 "${ROOT_DIR}/app.py" "${PACKAGE_DIR}/opt/macroeditor/app.py"

cp -r "${ROOT_DIR}/editor" "${PACKAGE_DIR}/opt/macroeditor/editor"
cp -r "${ROOT_DIR}/macros" "${PACKAGE_DIR}/opt/macroeditor/macros"
cp -r "${ROOT_DIR}/ui" "${PACKAGE_DIR}/opt/macroeditor/ui"
cp -r "${ROOT_DIR}/utils" "${PACKAGE_DIR}/opt/macroeditor/utils"

find "${PACKAGE_DIR}/opt/macroeditor" -type d -name "__pycache__" -prune -exec rm -rf {} +
find "${PACKAGE_DIR}/opt/macroeditor" -type f -name "*.pyc" -delete

dpkg-deb --root-owner-group --build "${PACKAGE_DIR}" "${OUTPUT_FILE}"
dpkg-deb --info "${OUTPUT_FILE}"
