"""Seed read-only routes and preserve coverage; never suppress or rewrite alerts."""
import json
from urllib.parse import urlsplit

_target = None


def zap_started(zap, target):
    global _target
    _target = urlsplit(target)
    if _target.scheme != "http" or _target.hostname != "127.0.0.1":
        raise ValueError("Only the dedicated loopback staging server may be scanned")
    for path in ("/", "/data.html", "/icon.svg", "/api/ai/status",
                 "/api/ai/embeddings", "/api/library/status", "/api/library/records"):
        zap.core.access_url(target.rstrip("/") + path, followredirects=False)


def zap_pre_shutdown(zap):
    paths = set()
    for value in zap.core.urls:
        url = urlsplit(value)
        if (url.scheme, url.netloc) == (_target.scheme, _target.netloc):
            paths.add(url.path or "/")
    evidence = {
        "paths": sorted(paths),
        "passivePending": int(zap.pscan.records_to_scan),
        "enabledRules": sorted(str(rule["id"]) for rule in zap.pscan.scanners
                               if str(rule.get("enabled")).lower() == "true"),
    }
    with open("/zap/wrk/scan-coverage.json", "w", encoding="utf-8") as output:
        json.dump(evidence, output, indent=2)
