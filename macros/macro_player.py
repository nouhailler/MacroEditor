"""Asynchronous macro playback implementation."""

from __future__ import annotations

import gi

gi.require_version("GLib", "2.0")

from gi.repository import GLib


class MacroPlayer:
    """Play macros without blocking the GTK main loop."""

    def __init__(self, editor, on_error, on_finished) -> None:
        self.editor = editor
        self.on_error = on_error
        self.on_finished = on_finished
        self._actions = []
        self._index = 0
        self._repeat_left = 0
        self._running = False

    @property
    def is_running(self) -> bool:
        """Return True while a macro playback is active."""
        return self._running

    def play_macro(self, macro, repeat_count: int = 1) -> None:
        """Start playing a macro asynchronously."""
        if self._running:
            self.on_error("A macro is already running.")
            return
        if repeat_count < 1:
            self.on_error("Repeat count must be at least 1.")
            return
        self._actions = list(macro.actions)
        self._index = 0
        self._repeat_left = repeat_count
        self._running = True
        self.editor.buffer.begin_user_action()
        GLib.idle_add(self._step)

    def _step(self):
        if not self._running:
            return False
        try:
            if self._repeat_left == 0:
                self._finish()
                return False
            if self._index >= len(self._actions):
                self._repeat_left -= 1
                self._index = 0
                return True
            command = self._actions[self._index]
            command.execute(self.editor)
            self._index += 1
            return True
        except Exception as exc:  # noqa: BLE001
            self._finish()
            self.on_error(f"Macro execution stopped: {exc}")
            return False

    def _finish(self) -> None:
        if self._running:
            self._running = False
            self.editor.buffer.end_user_action()
            self.on_finished()
