#!/usr/bin/env python3
# /// script
# dependencies = ["psutil", "pexpect"]
# ///
"""syswatch - simple local system monitor"""

import json
import os
import re
import shutil
import subprocess
import threading
import time
import psutil
import pexpect
from http.server import BaseHTTPRequestHandler, HTTPServer

# --- état réseau pour calculer le débit ---
_net_prev = None
_net_prev_time = None

# --- powermetrics (power consumption) ---
_power_data = {"cpu_mw": 0, "gpu_mw": 0, "ane_mw": 0, "combined_mw": 0, "available": False}
_power_lock = threading.Lock()

# --- plan usage via claude /usage ---
_plan_data = {"available": False}
_plan_lock = threading.Lock()

_RE_ANSI    = re.compile(r'\x1b(?:[@-Z\\-_]|\[[0-9;?]*[ -/]*[@-~])')
_RE_PCT     = re.compile(r'(\d+)%\s+used')
_RE_RESETS  = re.compile(r'Resets\s+(.+)')
_RE_SPENT   = re.compile(r'\$([0-9.]+)\s*/\s*\$([0-9.]+)\s+spent')


def _fetch_plan_usage():
    child = None
    try:
        # Si on tourne en root (sudo), spawner claude en tant qu'user normal
        sudo_user = os.environ.get('SUDO_USER')
        if sudo_user and os.geteuid() == 0:
            cmd  = 'sudo'
            args = ['-u', sudo_user, '-i', 'claude']
        else:
            cmd  = 'claude'
            args = []

        child = pexpect.spawn(
            cmd,
            args=args,
            timeout=20,
            encoding='utf-8',
            echo=False,
            dimensions=(50, 220),
        )

        # Attendre que Claude soit prêt (prompt interactif)
        child.expect([r'❯', r'> ', r'\$', pexpect.TIMEOUT], timeout=15)
        time.sleep(0.3)

        child.sendline('/usage')

        # Laisser le temps à claude de rendre tout le bloc /usage
        try:
            child.expect(pexpect.TIMEOUT, timeout=6)
        except Exception:
            pass
        output = child.before or ''

        # Nettoyer les codes ANSI et caractères de contrôle
        clean = _RE_ANSI.sub('', output)
        clean = clean.replace('\r', '').replace('\x00', '')

        pcts    = _RE_PCT.findall(clean)
        resets  = _RE_RESETS.findall(clean)
        spent_m = _RE_SPENT.search(clean)

        result = {
            'available':      True,
            'session_pct':    int(pcts[0])         if len(pcts) > 0    else 0,
            'week_pct':       int(pcts[1])          if len(pcts) > 1   else 0,
            'extra_pct':      int(pcts[2])          if len(pcts) > 2   else 0,
            'session_resets': resets[0].strip()     if len(resets) > 0 else '',
            'week_resets':    resets[1].strip()     if len(resets) > 1 else '',
            'extra_resets':   resets[2].strip()     if len(resets) > 2 else '',
            'spent':          float(spent_m.group(1)) if spent_m       else 0.0,
            'budget':         float(spent_m.group(2)) if spent_m       else 0.0,
            '_debug':         repr(clean[-800:]),   # temporaire pour debug
        }

        with _plan_lock:
            _plan_data.clear()
            _plan_data.update(result)

    except Exception as e:
        with _plan_lock:
            _plan_data['available'] = False
            _plan_data['error'] = str(e)
    finally:
        if child:
            try:
                child.close(force=True)
            except Exception:
                pass


def _plan_usage_worker():
    while True:
        _fetch_plan_usage()
        time.sleep(60)


def start_plan_usage_monitor():
    t = threading.Thread(target=_plan_usage_worker, daemon=True)
    t.start()


def get_plan_usage():
    with _plan_lock:
        return dict(_plan_data)


# --- powermetrics (power consumption) ---
_RE_CPU     = re.compile(r'CPU Power:\s+(\d+)\s+mW')
_RE_GPU     = re.compile(r'GPU Power:\s+(\d+)\s+mW')
_RE_ANE     = re.compile(r'ANE Power:\s+(\d+)\s+mW')
_RE_COMBINED = re.compile(r'Combined Power[^:]*:\s+(\d+)\s+mW')


def _powermetrics_worker():
    """Tourne en arrière-plan et lit la sortie de powermetrics en continu."""
    # Si on est root, pas besoin de sudo; sinon on essaie sudo -n
    cmd = ["powermetrics",
           "--samplers", "cpu_power,gpu_power,ane_power",
           "-i", "2000", "-n", "-1",
           "--format", "text",
           "--buffer-size", "0"]
    if os.geteuid() != 0:
        cmd = ["sudo", "-n"] + cmd

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )
    except FileNotFoundError:
        return  # powermetrics not found

    pending = {}
    for line in proc.stdout:
        line = line.strip()
        m = _RE_CPU.match(line)
        if m:
            pending["cpu_mw"] = int(m.group(1))
        m = _RE_GPU.match(line)
        if m:
            pending["gpu_mw"] = int(m.group(1))
        m = _RE_ANE.match(line)
        if m:
            pending["ane_mw"] = int(m.group(1))
        m = _RE_COMBINED.match(line)
        if m:
            pending["combined_mw"] = int(m.group(1))
            # combined_mw est la dernière ligne du bloc → on flush
            with _power_lock:
                _power_data.update(pending)
                _power_data["available"] = True
            pending = {}


def start_powermetrics():
    t = threading.Thread(target=_powermetrics_worker, daemon=True)
    t.start()


def get_power_usage():
    with _power_lock:
        return dict(_power_data)


def get_disk_usage():
    mounts = []

    main = shutil.disk_usage("/")
    mounts.append({
        "label": "Macintosh HD",
        "mount": "/",
        "total": main.total,
        "used": main.used,
        "free": main.free,
    })

    volumes_dir = "/Volumes"
    if os.path.isdir(volumes_dir):
        for vol in os.listdir(volumes_dir):
            vol_path = os.path.join(volumes_dir, vol)
            if os.path.ismount(vol_path) and vol_path != "/":
                try:
                    usage = shutil.disk_usage(vol_path)
                    mounts.append({
                        "label": vol,
                        "mount": vol_path,
                        "total": usage.total,
                        "used": usage.used,
                        "free": usage.free,
                    })
                except PermissionError:
                    pass

    return mounts


def get_ram_usage():
    mem = psutil.virtual_memory()
    return {
        "total": mem.total,
        "used": mem.used,
        "available": mem.available,
        "percent": mem.percent,
    }


def get_cpu_usage():
    return {
        "percent": psutil.cpu_percent(interval=None),
        "per_core": psutil.cpu_percent(interval=None, percpu=True),
    }


def get_network_usage():
    global _net_prev, _net_prev_time

    counters = psutil.net_io_counters()
    now = time.time()

    if _net_prev is None:
        _net_prev = counters
        _net_prev_time = now
        return {"bytes_sent_per_sec": 0, "bytes_recv_per_sec": 0}

    elapsed = now - _net_prev_time
    if elapsed == 0:
        return {"bytes_sent_per_sec": 0, "bytes_recv_per_sec": 0}

    sent_per_sec = (counters.bytes_sent - _net_prev.bytes_sent) / elapsed
    recv_per_sec = (counters.bytes_recv - _net_prev.bytes_recv) / elapsed

    _net_prev = counters
    _net_prev_time = now

    return {
        "bytes_sent_per_sec": max(0, sent_per_sec),
        "bytes_recv_per_sec": max(0, recv_per_sec),
    }


def get_claude_usage():
    """Agrège les tokens utilisés depuis toutes les sessions Claude Code actives."""
    home = os.path.expanduser("~")
    sessions_dir = os.path.join(home, ".claude", "sessions")
    projects_dir = os.path.join(home, ".claude", "projects")

    if not os.path.isdir(sessions_dir):
        return []

    results = []
    for fname in os.listdir(sessions_dir):
        if not fname.endswith(".json"):
            continue
        try:
            with open(os.path.join(sessions_dir, fname)) as f:
                session = json.load(f)
        except Exception:
            continue

        pid        = session.get("pid")
        session_id = session.get("sessionId")
        cwd        = session.get("cwd", "")

        if not pid or not session_id:
            continue
        if not psutil.pid_exists(pid):
            continue

        project_key = cwd.replace("/", "-")
        jsonl_path  = os.path.join(projects_dir, project_key, f"{session_id}.jsonl")
        if not os.path.exists(jsonl_path):
            continue

        totals = {
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 0,
        }
        model = None

        with open(jsonl_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    if entry.get("type") == "assistant":
                        msg = entry.get("message", {})
                        if isinstance(msg, dict):
                            if not model:
                                model = msg.get("model")
                            usage = msg.get("usage", {})
                            for key in totals:
                                totals[key] += usage.get(key, 0)
                except Exception:
                    continue

        results.append({
            "sessionId": session_id,
            "cwd": cwd,
            "model": model,
            **totals,
        })

    return results


def get_battery():
    batt = psutil.sensors_battery()
    if batt is None:
        return None
    return {
        "percent": batt.percent,
        "plugged": batt.power_plugged,
        "secs_left": batt.secsleft if batt.secsleft != psutil.POWER_TIME_UNLIMITED else -1,
    }


def json_response(handler, data):
    body = json.dumps(data).encode()
    handler.send_response(200)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(body)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        if self.path == "/api/ram":
            json_response(self, get_ram_usage())
        elif self.path == "/api/cpu":
            json_response(self, get_cpu_usage())
        elif self.path == "/api/network":
            json_response(self, get_network_usage())
        elif self.path == "/api/battery":
            json_response(self, get_battery())
        elif self.path == "/api/disks":
            json_response(self, get_disk_usage())
        elif self.path == "/api/claude":
            json_response(self, get_claude_usage())
        elif self.path == "/api/power":
            json_response(self, get_power_usage())
        elif self.path == "/api/plan":
            json_response(self, get_plan_usage())
        elif self.path == "/" or self.path == "/index.html":
            with open("index.html", "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_response(404)
            self.end_headers()


if __name__ == "__main__":
    psutil.cpu_percent(interval=None)
    get_network_usage()
    start_powermetrics()
    start_plan_usage_monitor()

    port = 8080
    server = HTTPServer(("localhost", port), Handler)
    print(f"syswatch running → http://localhost:{port}")
    print("Note: pour les données de puissance, lancer avec sudo")
    server.serve_forever()
