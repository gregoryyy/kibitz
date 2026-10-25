"""Startup policy tests with a stub launcher; no ZAP/network dependency on host."""
import importlib.util
import json
import re
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch, mock_open


def baseline_args(mode, port, extra):
    return ["/zap/zap-x.sh", mode, "-port", str(port), "-host", "0.0.0.0",
            "-config", "api.disablekey=true", "-config", "api.addrs.addr.name=.*",
            "-config", "api.addrs.addr.regex=true"] + extra


sys.modules["zap_common"] = types.SimpleNamespace(create_start_options=baseline_args)
spec = importlib.util.spec_from_file_location("scan_hooks", Path(__file__).with_name("hooks.py"))
hooks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hooks)


class StartupPolicy(unittest.TestCase):
    def test_replaces_first_host_preserving_scan_options(self):
        original = baseline_args("-daemon", 9911, ["-silent", "-config", "spider.maxDuration=1"])
        result = hooks._loopback_start_options("-daemon", 9911, ["-silent", "-config", "spider.maxDuration=1"])
        self.assertEqual(original[original.index("-host") + 1], "0.0.0.0")
        self.assertEqual(result[result.index("-host") + 1], "127.0.0.1")
        result[result.index("-host") + 1] = "0.0.0.0"
        address = next(i for i, arg in enumerate(result) if arg.startswith("api.addrs.addr.name="))
        result[address] = "api.addrs.addr.name=.*"
        self.assertEqual(result, original)

    def test_refuses_changed_or_duplicated_launcher_hosts(self):
        with self.assertRaises(ValueError):
            hooks._loopback_start_options("-daemon", 9911, ["-host", "127.0.0.1"])
        for args in (["-daemon"], ["-host", "unexpected"]):
            with patch.object(hooks, "_start_options", return_value=list(args)):
                with self.assertRaises(ValueError):
                    hooks._loopback_start_options("-daemon", 9911, [])

    def test_api_allows_exact_client_virtual_host_and_ipv4_loopback(self):
        result = hooks._loopback_start_options("-daemon", 9911, [])
        pattern = next(arg.split("=", 1)[1] for arg in result if arg.startswith("api.addrs.addr.name="))
        for allowed in ("127.0.0.1", "zap"):
            self.assertIsNotNone(re.fullmatch(pattern, allowed))
        for denied in ("untrusted.invalid", "127x0x0x1", "127.0.0.12", "zap.untrusted.invalid", "::1"):
            self.assertIsNone(re.fullmatch(pattern, denied))
        for extra in (["-config", "api.addrs.addr.name=.*"], ["-config", "api.addrs.addr.regex=false"]):
            with self.assertRaises(ValueError):
                hooks._loopback_start_options("-daemon", 9911, extra)

    def test_read_only_seeds_and_api_method_coverage(self):
        accessed = []
        target = "http://127.0.0.1:9912/"
        core = types.SimpleNamespace(
            access_url=lambda url, followredirects: accessed.append((url, followredirects)),
            urls=lambda: [target, target + "data.html", "https://untrusted.invalid/private"],
        )
        zap = types.SimpleNamespace(core=core, pscan=types.SimpleNamespace(
            records_to_scan="0", scanners=[{"id": "10038", "enabled": "true"},
                                           {"id": "10010", "enabled": False}]))
        hooks.zap_started(zap, target)
        self.assertEqual(len(accessed), 7)
        self.assertTrue(all(url.startswith(target) and not redirects for url, redirects in accessed))
        output = mock_open()
        with patch("builtins.open", output):
            hooks.zap_pre_shutdown(zap)
        data = json.loads("".join(call.args[0] for call in output().write.call_args_list))
        self.assertEqual(data, {"paths": ["/", "/data.html"], "passivePending": 0,
                                "enabledRules": ["10038"]})

    def test_seeding_refuses_foreign_or_tls_targets(self):
        for target in ("https://127.0.0.1:9912/", "http://untrusted.invalid/"):
            with self.assertRaises(ValueError):
                hooks.zap_started(None, target)


if __name__ == "__main__":
    unittest.main()
