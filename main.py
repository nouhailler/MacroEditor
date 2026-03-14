"""Entry point for MacroEditor."""

import sys

from app import MacroEditorApplication


def main() -> int:
    """Run the GTK application."""
    app = MacroEditorApplication()
    return app.run(sys.argv)


if __name__ == "__main__":
    raise SystemExit(main())
