#!/usr/bin/env python3
# /// script
# dependencies = ["psutil"]
# ///
"""syswatch - simple local system monitor"""

import json
import os
import re
import shutil
import subprocess
import threading
import time
from datetime import datetime
import psutil
from http.server import BaseHTTPRequestHandler, HTTPServer

# --- état réseau pour calculer le débit ---
_net_prev = None
_net_prev_time = None

# --- top processes cache ---
_proc_data = []
_proc_lock = threading.Lock()

# --- powermetrics (power consumption) ---
_power_data = {"cpu_mw": 0, "gpu_mw": 0, "ane_mw": 0, "combined_mw": 0,
               "thermal_pressure": "Nominal", "available": False, "cpu_clusters": [], "cpu_cores": []}
_power_lock = threading.Lock()

# --- plan usage via claude /usage ---
_plan_data = {"available": False}
_plan_lock = threading.Lock()
_plan_cache_max_age = 900.0

_RE_VM_STAT_PAGE_SIZE = re.compile(r'page size of\s+(\d+)\s+bytes')
_RE_VM_STAT_LINE = re.compile(r'^([^:]+):\s+([0-9.]+)\.?$')
_RE_MEMORY_PRESSURE = re.compile(r'System-wide memory free percentage:\s+(\d+)%')


def _get_real_home():
    sudo_user = os.environ.get("SUDO_USER")
    if sudo_user and os.geteuid() == 0:
        try:
            import pwd
            return pwd.getpwnam(sudo_user).pw_dir
        except Exception:
            pass
    return os.path.expanduser("~")


def _format_reset_timestamp(raw_ts):
    if raw_ts in (None, ""):
        return ""
    try:
        dt = datetime.fromtimestamp(float(raw_ts)).astimezone()
    except Exception:
        return ""

    now = datetime.now(dt.tzinfo)
    tz_name = dt.tzname() or "local"
    if dt.date() == now.date():
        return f"{dt.strftime('%H:%M')} ({tz_name})"
    return f"{dt.strftime('%b %d at %H:%M')} ({tz_name})"


def _read_statusline_plan_usage():
    plan_path = os.path.join(_get_real_home(), ".claude", "syswatch", "plan_usage.json")
    if not os.path.exists(plan_path):
        return None

    try:
        stat = os.stat(plan_path)
        if time.time() - stat.st_mtime > _plan_cache_max_age:
            return None
        with open(plan_path, encoding="utf-8") as f:
            payload = json.load(f)
    except Exception:
        return None

    rate_limits = payload.get("rate_limits") or {}
    five_hour = rate_limits.get("five_hour") or {}
    seven_day = rate_limits.get("seven_day") or {}
    if not five_hour and not seven_day:
        return None

    result = {
        "available": True,
        "session_pct": int(round(five_hour.get("used_percentage", 0) or 0)),
        "week_pct": int(round(seven_day.get("used_percentage", 0) or 0)),
        "session_resets": _format_reset_timestamp(five_hour.get("resets_at")),
        "week_resets": _format_reset_timestamp(seven_day.get("resets_at")),
        "source": "statusline",
        "updated_at": payload.get("timestamp") or stat.st_mtime,
    }

    session_cost = (payload.get("cost") or {}).get("total_cost_usd")
    if session_cost is not None:
        try:
            result["session_cost_usd"] = float(session_cost)
        except Exception:
            pass

    return result


def _merge_plan_with_current(result):
    with _plan_lock:
        current = dict(_plan_data)

    for key in ("error",):
        value = current.get(key)
        if value not in (None, ""):
            result[key] = value
    return result


def _fetch_plan_usage():
    cached = _read_statusline_plan_usage()
    if cached:
        cached = _merge_plan_with_current(cached)
        with _plan_lock:
            _plan_data.clear()
            _plan_data.update(cached)
        return

    with _plan_lock:
        _plan_data.clear()
        _plan_data.update({
            "available": False,
            "error": "Claude statusLine cache not available yet.",
        })


def _plan_usage_worker():
    while True:
        cached = _read_statusline_plan_usage()
        if cached:
            cached = _merge_plan_with_current(cached)
            with _plan_lock:
                _plan_data.clear()
                _plan_data.update(cached)
        else:
            _fetch_plan_usage()

        time.sleep(5)


def start_plan_usage_monitor():
    t = threading.Thread(target=_plan_usage_worker, daemon=True)
    t.start()


def get_plan_usage():
    cached = _read_statusline_plan_usage()
    if cached:
        cached = _merge_plan_with_current(cached)
        with _plan_lock:
            _plan_data.clear()
            _plan_data.update(cached)
    with _plan_lock:
        return dict(_plan_data)


# --- powermetrics (power consumption) ---
_RE_CPU      = re.compile(r'CPU Power:\s+(\d+)\s+mW')
_RE_GPU      = re.compile(r'GPU Power:\s+(\d+)\s+mW')
_RE_ANE      = re.compile(r'ANE Power:\s+(\d+)\s+mW')
_RE_COMBINED = re.compile(r'Combined Power[^:]*:\s+(\d+)\s+mW')
_RE_THERMAL  = re.compile(r'Current pressure level:\s+(\w+)')
_RE_CLUSTER_FREQ = re.compile(r'^([EPS])-Cluster HW active frequency:\s+([0-9.]+)\s*(MHz|GHz)$')
_RE_CLUSTER_ACTIVE = re.compile(r'^([EPS])-Cluster HW active residency:\s+([0-9.]+)%$')
_RE_CLUSTER_IDLE = re.compile(r'^([EPS])-Cluster HW idle residency:\s+([0-9.]+)%$')
_RE_CORE_FREQ = re.compile(r'^CPU\s+(\d+)\s+frequency:\s+([0-9.]+)\s*(MHz|GHz)$')
_RE_CORE_ACTIVE = re.compile(r'^CPU\s+(\d+)\s+active residency:\s+([0-9.]+)%$')
_RE_CORE_IDLE = re.compile(r'^CPU\s+(\d+)\s+idle residency:\s+([0-9.]+)%$')

_cpu_static_info = None


def _parse_freq_mhz(raw_value, unit):
    value = float(raw_value)
    if unit == "GHz":
        value *= 1000
    return round(value, 1)


def _read_sysctl(name):
    try:
        proc = subprocess.run(["sysctl", "-n", name], capture_output=True, text=True, check=True)
        return proc.stdout.strip()
    except Exception:
        return None


def _get_cpu_static_info():
    global _cpu_static_info
    if _cpu_static_info is not None:
        return _cpu_static_info

    model = _read_sysctl("machdep.cpu.brand_string") or _read_sysctl("hw.model") or "Apple Silicon"
    physical = psutil.cpu_count(logical=False)
    logical = psutil.cpu_count(logical=True)

    _cpu_static_info = {
        "model": model,
        "architecture": os.uname().machine,
        "physical_cores": physical,
        "logical_cores": logical,
    }
    return _cpu_static_info


def _powermetrics_worker():
    """Tourne en arrière-plan et lit la sortie de powermetrics en continu."""
    # Si on est root, pas besoin de sudo; sinon on essaie sudo -n
    cmd = ["powermetrics",
           "--samplers", "cpu_power,gpu_power,ane_power,thermal",
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
    cluster_metrics = {}
    core_metrics = {}
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
        m = _RE_THERMAL.match(line)
        if m:
            pending["thermal_pressure"] = m.group(1)
        m = _RE_CLUSTER_FREQ.match(line)
        if m:
            cluster_key = m.group(1)
            cluster_metrics.setdefault(cluster_key, {})["frequency_mhz"] = _parse_freq_mhz(m.group(2), m.group(3))
        m = _RE_CLUSTER_ACTIVE.match(line)
        if m:
            cluster_key = m.group(1)
            cluster_metrics.setdefault(cluster_key, {})["active_residency_pct"] = float(m.group(2))
        m = _RE_CLUSTER_IDLE.match(line)
        if m:
            cluster_key = m.group(1)
            cluster_metrics.setdefault(cluster_key, {})["idle_residency_pct"] = float(m.group(2))
        m = _RE_CORE_FREQ.match(line)
        if m:
            core_id = int(m.group(1))
            core_metrics.setdefault(core_id, {})["frequency_mhz"] = _parse_freq_mhz(m.group(2), m.group(3))
        m = _RE_CORE_ACTIVE.match(line)
        if m:
            core_id = int(m.group(1))
            core_metrics.setdefault(core_id, {})["active_residency_pct"] = float(m.group(2))
        m = _RE_CORE_IDLE.match(line)
        if m:
            core_id = int(m.group(1))
            core_metrics.setdefault(core_id, {})["idle_residency_pct"] = float(m.group(2))
        m = _RE_COMBINED.match(line)
        if m:
            pending["combined_mw"] = int(m.group(1))
            pending["cpu_clusters"] = [
                {"key": key, **cluster_metrics[key]}
                for key in sorted(cluster_metrics.keys())
            ]
            pending["cpu_cores"] = [
                {"core": core_id, **core_metrics[core_id]}
                for core_id in sorted(core_metrics.keys())
            ]
            # combined_mw est la dernière ligne du bloc → on flush
            with _power_lock:
                _power_data.update(pending)
                _power_data["available"] = True
            pending = {}
            cluster_metrics = {}
            core_metrics = {}


def start_powermetrics():
    t = threading.Thread(target=_powermetrics_worker, daemon=True)
    t.start()


def get_power_usage():
    with _power_lock:
        return dict(_power_data)


def _decode_i64(value):
    if value is None:
        return None
    if value >= 2**63:
        return value - 2**64
    return value


def _parse_ioreg_value(raw):
    raw = raw.strip()
    if raw in {"Yes", "No"}:
        return raw == "Yes"
    if raw.startswith('"') and raw.endswith('"'):
        return raw[1:-1]
    try:
        return int(raw)
    except ValueError:
        return raw


def _extract_ioreg_int(text, key):
    m = re.search(r'"' + re.escape(key) + r'"=(-?\d+)', text)
    return int(m.group(1)) if m else None


def _extract_ioreg_list(text, key):
    m = re.search(r'"' + re.escape(key) + r'"=\(([^)]+)\)', text)
    if not m:
        return None
    parts = [x.strip() for x in m.group(1).split(',')]
    try:
        return [int(x) for x in parts]
    except ValueError:
        return None


def get_battery_details():
    cmd = ["ioreg", "-r", "-n", "AppleSmartBattery"]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
    except Exception:
        return {"available": False}

    wanted = {
        "Temperature",
        "VirtualTemperature",
        "Voltage",
        "Amperage",
        "InstantAmperage",
        "BatteryPower",
        "TimeRemaining",
        "CycleCount",
        "DesignCapacity",
        "NominalChargeCapacity",
        "CurrentCapacity",
        "FullyCharged",
        "ExternalConnected",
        "IsCharging",
        "DeviceName",
        "DesignCycleCount9C",
        "AppleRawMaxCapacity",
        "MaxCapacity",
        "AdapterDetails",
        "ChargerData",
        "BatteryData",
    }
    values = {}
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line.startswith('"') or '" = ' not in line:
            continue
        key, raw_value = line.split('" = ', 1)
        key = key.strip('"')
        if key not in wanted:
            continue
        values[key] = _parse_ioreg_value(raw_value)

    if not values:
        return {"available": False}

    temperature_raw = values.get("Temperature")
    virtual_temperature_raw = values.get("VirtualTemperature")
    amperage_raw = values.get("Amperage")
    instant_amperage_raw = values.get("InstantAmperage")
    battery_power_raw = values.get("BatteryPower")

    cycle_count = values.get("CycleCount")
    design_cycle_count = values.get("DesignCycleCount9C")
    raw_max_capacity = values.get("AppleRawMaxCapacity")
    design_capacity = values.get("DesignCapacity")

    cycle_health_pct = None
    if isinstance(cycle_count, int) and isinstance(design_cycle_count, int) and design_cycle_count > 0:
        cycle_health_pct = round((1 - cycle_count / design_cycle_count) * 100, 1)

    capacity_health_pct = None
    if isinstance(raw_max_capacity, int) and isinstance(design_capacity, int) and design_capacity > 0:
        capacity_health_pct = round(raw_max_capacity / design_capacity * 100, 1)

    adapter_raw = values.get("AdapterDetails", "")
    adapter_watts = _extract_ioreg_int(adapter_raw, "Watts") if isinstance(adapter_raw, str) else None
    adapter_voltage_mv = _extract_ioreg_int(adapter_raw, "AdapterVoltage") if isinstance(adapter_raw, str) else None
    adapter_current_ma = _extract_ioreg_int(adapter_raw, "Current") if isinstance(adapter_raw, str) else None

    charger_raw = values.get("ChargerData", "")
    charging_voltage_mv = _extract_ioreg_int(charger_raw, "ChargingVoltage") if isinstance(charger_raw, str) else None
    charging_current_ma = _extract_ioreg_int(charger_raw, "ChargingCurrent") if isinstance(charger_raw, str) else None

    battery_data_raw = values.get("BatteryData", "")
    cell_voltages_mv = None
    full_charge_capacity_mah = None
    data_flash_write_count = None
    lifetime_operating_time_min = None
    lifetime_max_temp_c = None
    lifetime_min_temp_c = None
    lifetime_avg_temp_raw = None
    lifetime_max_charge_current_ma = None

    if isinstance(battery_data_raw, str) and battery_data_raw:
        cell_voltages_mv = _extract_ioreg_list(battery_data_raw, "CellVoltage")
        full_charge_capacity_mah = _extract_ioreg_int(battery_data_raw, "FccComp1")
        data_flash_write_count = _extract_ioreg_int(battery_data_raw, "DataFlashWriteCount")
        lifetime_operating_time_min = _extract_ioreg_int(battery_data_raw, "TotalOperatingTime")
        lifetime_max_temp_c = _extract_ioreg_int(battery_data_raw, "MaximumTemperature")
        lifetime_min_temp_c = _extract_ioreg_int(battery_data_raw, "MinimumTemperature")
        lifetime_avg_temp_raw = _extract_ioreg_int(battery_data_raw, "AverageTemperature")
        lifetime_max_charge_current_ma = _extract_ioreg_int(battery_data_raw, "MaximumChargeCurrent")

    return {
        "available": True,
        "device_name": values.get("DeviceName"),
        "temperature_raw": temperature_raw,
        "temperature_c": round(temperature_raw / 100, 2) if isinstance(temperature_raw, int) else None,
        "virtual_temperature_raw": virtual_temperature_raw,
        "virtual_temperature_c": round(virtual_temperature_raw / 100, 2) if isinstance(virtual_temperature_raw, int) else None,
        "voltage_mv": values.get("Voltage"),
        "amperage_ma": _decode_i64(amperage_raw) if isinstance(amperage_raw, int) else None,
        "instant_amperage_ma": _decode_i64(instant_amperage_raw) if isinstance(instant_amperage_raw, int) else None,
        "battery_power_mw": _decode_i64(battery_power_raw) if isinstance(battery_power_raw, int) else None,
        "time_remaining_min": values.get("TimeRemaining"),
        "cycle_count": cycle_count,
        "design_cycle_count": design_cycle_count,
        "cycle_health_pct": cycle_health_pct,
        "design_capacity_mah": design_capacity,
        "raw_max_capacity_mah": raw_max_capacity,
        "full_charge_capacity_mah": full_charge_capacity_mah,
        "capacity_health_pct": capacity_health_pct,
        "max_capacity_pct": values.get("MaxCapacity"),
        "nominal_charge_capacity_mah": values.get("NominalChargeCapacity"),
        "current_capacity_pct": values.get("CurrentCapacity"),
        "fully_charged": values.get("FullyCharged"),
        "external_connected": values.get("ExternalConnected"),
        "is_charging": values.get("IsCharging"),
        "adapter_watts": adapter_watts,
        "adapter_voltage_mv": adapter_voltage_mv,
        "adapter_current_ma": adapter_current_ma,
        "charging_voltage_mv": charging_voltage_mv,
        "charging_current_ma": charging_current_ma,
        "cell_voltages_mv": cell_voltages_mv,
        "data_flash_write_count": data_flash_write_count,
        "lifetime_operating_time_min": lifetime_operating_time_min,
        "lifetime_max_temp_c": lifetime_max_temp_c,
        "lifetime_min_temp_c": lifetime_min_temp_c,
        "lifetime_avg_temp_raw": lifetime_avg_temp_raw,
        "lifetime_max_charge_current_ma": lifetime_max_charge_current_ma,
    }


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


def _get_vm_stat_details():
    try:
        proc = subprocess.run(["vm_stat"], capture_output=True, text=True, check=True)
    except Exception:
        return {}

    page_size = 4096
    stats = {}
    for line in proc.stdout.splitlines():
        line = line.strip()
        page_size_match = _RE_VM_STAT_PAGE_SIZE.search(line)
        if page_size_match:
            page_size = int(page_size_match.group(1))
            continue

        match = _RE_VM_STAT_LINE.match(line)
        if not match:
            continue

        key = match.group(1).strip().lower().replace(" ", "_").replace('"', '')
        stats[key] = int(float(match.group(2)))

    return {
        "page_size": page_size,
        "compressed_pages": stats.get("pages_stored_in_compressor"),
        "compressed_bytes": stats.get("pages_stored_in_compressor", 0) * page_size,
        "purgeable_pages": stats.get("pages_purgeable"),
        "purgeable_bytes": stats.get("pages_purgeable", 0) * page_size,
    }


def _get_memory_pressure():
    try:
        proc = subprocess.run(["memory_pressure"], capture_output=True, text=True, check=True)
    except Exception:
        return {"available": False}

    match = _RE_MEMORY_PRESSURE.search(proc.stdout)
    if not match:
        return {"available": False}

    return {"available": True, "free_pct": int(match.group(1))}


def get_ram_usage():
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    vm_stats = _get_vm_stat_details()
    pressure = _get_memory_pressure()

    return {
        "total": mem.total,
        "used": mem.used,
        "available": mem.available,
        "free": getattr(mem, "free", None),
        "active": getattr(mem, "active", None),
        "inactive": getattr(mem, "inactive", None),
        "wired": getattr(mem, "wired", None),
        "compressed": vm_stats.get("compressed_bytes"),
        "purgeable": vm_stats.get("purgeable_bytes"),
        "percent": mem.percent,
        "swap_total": swap.total,
        "swap_used": swap.used,
        "swap_free": swap.free,
        "swap_in": getattr(swap, "sin", None),
        "swap_out": getattr(swap, "sout", None),
        "memory_pressure_pct": pressure.get("free_pct"),
        "memory_pressure_available": pressure.get("available", False),
    }


def get_cpu_usage():
    cpu_times = psutil.cpu_times_percent(interval=None)
    load1, load5, load15 = os.getloadavg()
    static_info = _get_cpu_static_info()
    with _power_lock:
        clusters = [dict(cluster) for cluster in _power_data.get("cpu_clusters", [])]
        cores = [dict(core) for core in _power_data.get("cpu_cores", [])]

    return {
        "percent": psutil.cpu_percent(interval=None),
        "per_core": psutil.cpu_percent(interval=None, percpu=True),
        "load_avg": {"one": round(load1, 2), "five": round(load5, 2), "fifteen": round(load15, 2)},
        "times_pct": {
            "user": round(cpu_times.user, 1),
            "system": round(cpu_times.system, 1),
            "idle": round(cpu_times.idle, 1),
            "nice": round(getattr(cpu_times, "nice", 0.0), 1),
        },
        "model": static_info["model"],
        "architecture": static_info["architecture"],
        "physical_cores": static_info["physical_cores"],
        "logical_cores": static_info["logical_cores"],
        "clusters": clusters,
        "core_metrics": cores,
        "power_metrics_available": bool(clusters or cores),
    }


def _proc_worker():
    # Initialisation du cpu_percent pour que le premier delta soit valide
    for p in psutil.process_iter():
        try:
            p.cpu_percent(interval=None)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    time.sleep(1)

    while True:
        procs = []
        for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info', 'status']):
            try:
                info = p.info
                if info['status'] == 'zombie':
                    continue
                mem_mb = round((info['memory_info'].rss if info['memory_info'] else 0) / 1e6, 1)
                procs.append({
                    'pid': info['pid'],
                    'name': info['name'],
                    'cpu': round(info['cpu_percent'] or 0, 1),
                    'mem_mb': mem_mb,
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        procs.sort(key=lambda x: x['cpu'], reverse=True)
        with _proc_lock:
            _proc_data.clear()
            _proc_data.extend(procs[:5])

        time.sleep(3)


def start_proc_monitor():
    t = threading.Thread(target=_proc_worker, daemon=True)
    t.start()


def get_top_processes():
    with _proc_lock:
        return list(_proc_data)


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


def get_codex_usage():
    """Lit les sessions Codex du jour et retourne tokens + rate_limits depuis les JSONLs."""
    import glob
    import sqlite3 as _sqlite3
    home = os.path.expanduser("~")
    sessions_root = os.path.join(home, ".codex", "sessions")
    db_path = os.path.join(home, ".codex", "logs_2.sqlite")

    if not os.path.isdir(sessions_root):
        return []

    # Collecte tous les JSONLs des dernières 24h
    cutoff = time.time() - 86400
    jsonl_files = [
        p for p in glob.glob(os.path.join(sessions_root, "**", "*.jsonl"), recursive=True)
        if os.path.getmtime(p) >= cutoff
    ]
    if not jsonl_files:
        return []

    # Token counts réels depuis SQLite (dernier usage cumulatif par thread_id)
    token_totals = {}
    if os.path.exists(db_path):
        try:
            con = _sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=2)
            cur = con.execute(
                "SELECT feedback_log_body FROM logs "
                "WHERE feedback_log_body LIKE '%\"usage\":{\"input_tokens%' "
                "ORDER BY ts ASC"
            )
            for (body,) in cur:
                t = re.search(r'thread_id=([a-f0-9-]+)', body)
                m = re.search(r' model=([^\s}:]+)', body)
                u = re.search(r'"usage":\{"input_tokens":(\d+)[^}]*"output_tokens":(\d+)[^}]*"total_tokens":(\d+)', body)
                if t and u:
                    tid = t.group(1)
                    token_totals[tid] = {
                        "input_tokens":  int(u.group(1)),
                        "output_tokens": int(u.group(2)),
                        "total_tokens":  int(u.group(3)),
                        "model": m.group(1) if m else None,
                    }
            con.close()
        except Exception:
            pass

    results = []
    for path in sorted(jsonl_files, key=os.path.getmtime, reverse=True):
        fname = os.path.basename(path)
        # session id = UUID at end of filename
        m = re.search(r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$', fname)
        session_id = m.group(1) if m else fname

        rate_limits = None
        with open(path, encoding="utf-8") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                    p = obj.get("payload", {})
                    if isinstance(p, dict) and p.get("type") == "token_count":
                        rate_limits = p.get("rate_limits")
                except Exception:
                    continue

        if rate_limits is None:
            continue

        tokens = token_totals.get(session_id, {})
        results.append({
            "sessionId": session_id,
            "model": tokens.get("model"),
            "input_tokens":  tokens.get("input_tokens", 0),
            "output_tokens": tokens.get("output_tokens", 0),
            "total_tokens":  tokens.get("total_tokens", 0),
            "primary_pct":   rate_limits.get("primary", {}).get("used_percent", 0),
            "primary_resets_at": rate_limits.get("primary", {}).get("resets_at"),
            "primary_window_minutes": rate_limits.get("primary", {}).get("window_minutes"),
            "secondary_pct": rate_limits.get("secondary", {}).get("used_percent", 0),
            "secondary_resets_at": rate_limits.get("secondary", {}).get("resets_at"),
            "secondary_window_minutes": rate_limits.get("secondary", {}).get("window_minutes"),
            "plan_type": rate_limits.get("plan_type"),
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
        elif self.path == "/api/codex":
            json_response(self, get_codex_usage())
        elif self.path == "/api/power":
            json_response(self, get_power_usage())
        elif self.path == "/api/battery-details":
            json_response(self, get_battery_details())
        elif self.path == "/api/processes":
            json_response(self, get_top_processes())
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
    start_proc_monitor()

    port = 8080
    server = HTTPServer(("localhost", port), Handler)
    print(f"syswatch running → http://localhost:{port}")
    print("Note: pour les données de puissance, lancer avec sudo")
    server.serve_forever()
