#!/usr/bin/env python3
import json
import os
from pathlib import Path


def main():
    repo_root = Path(__file__).resolve().parents[1]
    script_path = repo_root / "scripts" / "claude-statusline-export.py"
    settings_path = Path.home() / ".claude" / "settings.json"
    settings_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        settings = json.loads(settings_path.read_text(encoding="utf-8"))
        if not isinstance(settings, dict):
            settings = {}
    except FileNotFoundError:
        settings = {}
    except Exception:
        settings = {}

    settings["statusLine"] = {
        "type": "command",
        "command": f"python3 {script_path}",
        "refreshInterval": 3,
    }

    settings_path.write_text(json.dumps(settings, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {settings_path}")
    print("Restart Claude Code or trigger a new message to refresh the status line.")


if __name__ == "__main__":
    main()
