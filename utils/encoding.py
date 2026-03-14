"""Encoding helpers for file IO."""

from __future__ import annotations

from pathlib import Path


def read_text_file(path: str | Path) -> tuple[str, str]:
    """Read a UTF-8 text file from disk."""
    file_path = Path(path)
    return file_path.read_text(encoding="utf-8"), "UTF-8"


def write_text_file(path: str | Path, text: str, encoding: str = "UTF-8") -> None:
    """Write text to disk with the requested encoding."""
    file_path = Path(path)
    file_path.write_text(text, encoding=encoding.lower())
