#!/usr/bin/env python3
import time
import json
import os
import urllib.request
import urllib.error
import subprocess

# This agent runs on Hetzner servers and collects metrics, sending them to the central dashboard.

DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "http://localhost:3000/api/metrics/ingest")
API_KEY = os.environ.get("AGENT_API_KEY", "default_key")
SERVER_ID = os.environ.get("SERVER_ID", "local")

def get_cpu_usage():
    with open('/proc/stat', 'r') as f:
        line = f.readline()
    parts = line.split()
    idle = float(parts[4])
    total = sum(float(p) for p in parts[1:8])
    return idle, total

def get_mem_usage():
    mem = {}
    with open('/proc/meminfo', 'r') as f:
        for line in f:
            parts = line.split(':')
            if len(parts) == 2:
                mem[parts[0]] = int(parts[1].split()[0])
    
    total = mem.get('MemTotal', 0)
    free = mem.get('MemFree', 0)
    cached = mem.get('Cached', 0)
    buffers = mem.get('Buffers', 0)
    
    used = total - free - cached - buffers
    return {
        "total": total * 1024,
        "used": used * 1024,
        "cached": cached * 1024,
        "free": free * 1024
    }

def get_disk_io():
    # Simple implementation, returning total blocks read/write for primary disk
    try:
        with open('/proc/diskstats', 'r') as f:
            for line in f:
                parts = line.split()
                # Looking for main block device like sda, vda, nvme0n1
                if parts[2] in ['sda', 'vda', 'nvme0n1']:
                    return {
                        "read_ops": int(parts[3]),
                        "read_bytes": int(parts[5]) * 512,
                        "write_ops": int(parts[7]),
                        "write_bytes": int(parts[9]) * 512
                    }
    except Exception:
        pass
    return {"read_ops": 0, "read_bytes": 0, "write_ops": 0, "write_bytes": 0}

def get_network_traffic():
    try:
        with open('/proc/net/dev', 'r') as f:
            lines = f.readlines()
        
        rx_bytes = 0
        tx_bytes = 0
        
        for line in lines[2:]:
            parts = line.split(':')
            if len(parts) == 2 and parts[0].strip() != 'lo':
                data = parts[1].split()
                rx_bytes += int(data[0])
                tx_bytes += int(data[8])
                
        return {"rx_bytes": rx_bytes, "tx_bytes": tx_bytes}
    except Exception:
        return {"rx_bytes": 0, "tx_bytes": 0}

def get_hardware_status():
    status = {}
    # Try to get temperature
    try:
        if os.path.exists('/sys/class/thermal/thermal_zone0/temp'):
            with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                status['cpu_temp'] = int(f.read().strip()) / 1000.0
    except Exception:
        pass
        
    try:
        with open('/proc/uptime', 'r') as f:
            status['uptime'] = float(f.readline().split()[0])
    except Exception:
        pass
        
    return status

last_cpu_idle, last_cpu_total = get_cpu_usage()
last_net = get_network_traffic()
last_time = time.time()

while True:
    time.sleep(2)
    current_time = time.time()
    dt = current_time - last_time
    
    current_cpu_idle, current_cpu_total = get_cpu_usage()
    current_net = get_network_traffic()
    
    idle_delta = current_cpu_idle - last_cpu_idle
    total_delta = current_cpu_total - last_cpu_total
    
    cpu_usage_pct = 0.0
    if total_delta > 0:
        cpu_usage_pct = 100.0 * (1.0 - idle_delta / total_delta)
        
    rx_rate = (current_net['rx_bytes'] - last_net['rx_bytes']) / dt
    tx_rate = (current_net['tx_bytes'] - last_net['tx_bytes']) / dt
    
    metrics = {
        "server_id": SERVER_ID,
        "timestamp": current_time,
        "cpu": {
            "usage_percent": cpu_usage_pct
        },
        "memory": get_mem_usage(),
        "disk": get_disk_io(),
        "network": {
            "rx_bps": rx_rate * 8,
            "tx_bps": tx_rate * 8
        },
        "hardware": get_hardware_status()
    }
    
    last_cpu_idle, last_cpu_total = current_cpu_idle, current_cpu_total
    last_net = current_net
    last_time = current_time
    
    # Send metrics
    try:
        data = json.dumps(metrics).encode('utf-8')
        req = urllib.request.Request(DASHBOARD_URL, data=data, headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {API_KEY}'
        }, method='POST')
        
        with urllib.request.urlopen(req, timeout=5) as response:
            pass # Ignore response for now
    except Exception as e:
        print(f"Failed to send metrics: {e}")
