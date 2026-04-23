"""Rectangular column selection support for GtkSourceView."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class ColumnSelectionBounds:
    """Logical bounds for a rectangular selection."""

    start_line: int
    start_column: int
    end_line: int
    end_column: int


class ColumnSelectionManager:
    """Track and render a rectangular selection using text tags."""

    def __init__(self, buffer) -> None:
        self.buffer = buffer
        self.tag = buffer.create_tag(
            "column-selection",
            background="#4a90d9",
            foreground="#ffffff",
        )
        self.bounds: ColumnSelectionBounds | None = None

    def has_selection(self) -> bool:
        """Return True when a rectangular selection is active."""
        return self.bounds is not None

    def clear(self) -> None:
        """Remove any active rectangular selection."""
        start = self.buffer.get_start_iter()
        end = self.buffer.get_end_iter()
        self.buffer.remove_tag(self.tag, start, end)
        self.bounds = None

    def update(self, start_line: int, start_column: int, end_line: int, end_column: int) -> None:
        """Set new rectangular bounds and repaint the selection."""
        self.clear()
        top = min(start_line, end_line)
        bottom = max(start_line, end_line)
        left = min(start_column, end_column)
        right = max(start_column, end_column)
        if top == bottom and left == right:
            return
        self.bounds = ColumnSelectionBounds(top, left, bottom, right)
        for line in range(top, bottom + 1):
            start_iter = self._iter_at_line_column(line, left)
            end_iter = self._iter_at_line_column(line, right)
            if start_iter.compare(end_iter) < 0:
                self.buffer.apply_tag(self.tag, start_iter, end_iter)

    def get_selected_text(self) -> str:
        """Return rectangular selection contents joined by newlines."""
        if self.bounds is None:
            return ""
        chunks = []
        for line in range(self.bounds.start_line, self.bounds.end_line + 1):
            start_iter = self._iter_at_line_column(line, self.bounds.start_column)
            end_iter = self._iter_at_line_column(line, self.bounds.end_column)
            chunks.append(self.buffer.get_text(start_iter, end_iter, True))
        return "\n".join(chunks)

    def delete_selected_text(self) -> None:
        """Delete the current rectangular selection from bottom to top."""
        if self.bounds is None:
            return
        for line in range(self.bounds.end_line, self.bounds.start_line - 1, -1):
            start_iter = self._iter_at_line_column(line, self.bounds.start_column)
            end_iter = self._iter_at_line_column(line, self.bounds.end_column)
            if start_iter.compare(end_iter) < 0:
                self.buffer.delete(start_iter, end_iter)
        self.clear()

    def _iter_at_line_column(self, line: int, column: int):
        line_result = self.buffer.get_iter_at_line(line)
        line_iter = line_result.iter if hasattr(line_result, "iter") else line_result[1]
        end_iter = line_iter.copy()
        end_iter.forward_to_line_end()
        line_length = end_iter.get_line_offset()
        offset_result = self.buffer.get_iter_at_line_offset(line, min(column, line_length))
        return offset_result.iter if hasattr(offset_result, "iter") else offset_result[1]
