"""Seed read-only routes and preserve coverage; never suppress or rewrite alerts."""
import json
import zap_common
from urllib.parse import urlsplit

_target = None
_start_options = zap_common.create_start_options


def _loopback_start_options(mode, port, extra_params):
    # Pinned baseline hardcodes -host 0.0.0.0; network 0.31.0 uses the FIRST
    # -host argument, so appending another does not override it. Change only this
    # launcher boundary. Abort on source drift; do not alter scanner/rule options.
    args = _start_options(mode, port, extra_params)
    if args.count("-host") != 1:
        raise ValueError("Unexpected pinned ZAP host options")
    index = args.index("-host") + 1
    if args[index] != "0.0.0.0":
        raise ValueError("Unexpected pinned ZAP listener default")
    args[index] = "127.0.0.1"
    # This list checks remote addresses AND API Host headers. ZAPv2 deliberately
    # uses virtual host "zap" through its local proxy; allow that exact name too.
    addresses = [i for i, arg in enumerate(args) if arg.startswith("api.addrs.addr.name=")]
    regex = [arg for arg in args if arg.startswith("api.addrs.addr.regex=")]
    if len(addresses) != 1 or args[addresses[0]] != "api.addrs.addr.name=.*" or regex != ["api.addrs.addr.regex=true"]:
        raise ValueError("Unexpected pinned ZAP API address defaults")
    args[addresses[0]] = "api.addrs.addr.name=^(127[.]0[.]0[.]1|zap)$"
    return args


zap_common.create_start_options = _loopback_start_options


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
    for value in zap.core.urls():
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
