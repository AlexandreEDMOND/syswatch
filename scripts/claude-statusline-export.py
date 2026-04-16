#!/usr/bin/env python3
import json
import os
import sys
import tempfile
import time


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    target_dir = os.path.expanduser("~/.claude/syswatch")
    os.makedirs(target_dir, exist_ok=True)
    target_path = os.path.join(target_dir, "plan_usage.json")

    data = {
        "timestamp": time.time(),
        "session_id": payload.get("session_id"),
        "cwd": payload.get("workspace", {}).get("current_dir") or payload.get("cwd"),
        "model": payload.get("model"),
        "rate_limits": payload.get("rate_limits"),
        "cost": payload.get("cost"),
        "version": payload.get("version"),
    }

    fd, tmp_path = tempfile.mkstemp(prefix="plan_usage.", suffix=".json", dir=target_dir)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=True)
        os.replace(tmp_path, target_path)
    finally:
        try:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
        except Exception:
            pass

    model = ((payload.get("model") or {}).get("display_name")) or "Claude"
    five_hour = ((payload.get("rate_limits") or {}).get("five_hour") or {}).get("used_percentage")
    seven_day = ((payload.get("rate_limits") or {}).get("seven_day") or {}).get("used_percentage")

    parts = [f"[{model}]"]
    if five_hour is not None:
        parts.append(f"5h {round(five_hour)}%")
    if seven_day is not None:
        parts.append(f"7d {round(seven_day)}%")
    print(" | ".join(parts))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
