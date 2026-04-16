#!/usr/bin/env python3
# /// script
# dependencies = ["psutil"]
# ///
"""syswatch - simple local system monitor"""

import json
import os
import shutil
import time
import psutil
from http.server import BaseHTTPRequestHandler, HTTPServer

# --- état réseau pour calculer le débit ---
_net_prev = None
_net_prev_time = None


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
    # Initialise le compteur réseau avant de démarrer
    psutil.cpu_percent(interval=None)
    get_network_usage()

    port = 8080
    server = HTTPServer(("localhost", port), Handler)
    print(f"syswatch running → http://localhost:{port}")
    server.serve_forever()
