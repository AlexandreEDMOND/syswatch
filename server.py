#!/usr/bin/env python3
# /// script
# dependencies = ["psutil"]
# ///
"""syswatch - simple local system monitor"""

import json
import shutil
import psutil
from http.server import BaseHTTPRequestHandler, HTTPServer

def get_disk_usage():
    mounts = []

    # Disque principal
    main = shutil.disk_usage("/")
    mounts.append({
        "label": "Macintosh HD",
        "mount": "/",
        "total": main.total,
        "used": main.used,
        "free": main.free,
    })

    # Disques externes (volumes montés dans /Volumes sauf Macintosh HD)
    import os
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


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # silence les logs HTTP

    def do_GET(self):
        if self.path == "/api/ram":
            data = get_ram_usage()
            body = json.dumps(data).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

        elif self.path == "/api/disks":
            data = get_disk_usage()
            body = json.dumps(data).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

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
    port = 8080
    server = HTTPServer(("localhost", port), Handler)
    print(f"syswatch running → http://localhost:{port}")
    server.serve_forever()
