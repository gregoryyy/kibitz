# Kibitz: start and test the two variants.
#   just claude        build and serve claude/ on :8765
#   just codex         serve codex/ on :8766
#   just both          serve both at once; Ctrl-C stops both
# Ports and bind address can be overridden: just claude_port=9000 claude

claude_port := env_var_or_default("CLAUDE_PORT", "8765")
codex_port := env_var_or_default("CODEX_PORT", "8766")
host := env_var_or_default("KIBITZ_HOST", "127.0.0.1")

# List recipes
default:
    @just --list

# Install dependencies: AI gateway (root) and claude/ (each skipped if already installed)
install:
    @[ -d node_modules ] || npm ci
    @[ -d claude/node_modules ] || npm --prefix claude ci

# Build claude/ into claude/dist
build: install
    npm --prefix claude run build

# Rebuild the opening table (claude/dist/eco.json)
build-eco: install
    npm --prefix claude run build:eco

# claude/dist/index.html is the bare artifact body (no <head>), so "/" serves the full-document _test.html.
# --api mounts the AI gateway, configured from .env (see .env.example). Only codex/ calls it so far,
# so the claude/ server doesn't load the keys.
serve_claude := "node scripts/serve.mjs claude/dist --index _test.html --port " + claude_port + " --host " + host
serve_codex := "node scripts/serve.mjs codex --api --port " + codex_port + " --host " + host

# Build and serve the claude/ variant
claude: build
    {{serve_claude}}

# Serve the codex/ variant with the AI coach (no build step)
codex: install
    {{serve_codex}}

# Serve both variants side by side; Ctrl-C stops both
both: build
    #!/usr/bin/env bash
    set -euo pipefail
    trap 'kill $(jobs -p) 2>/dev/null || true' EXIT
    {{serve_claude}} & a=$!
    {{serve_codex}} & b=$!
    # Stop as soon as either server exits (e.g. port in use), not only on Ctrl-C.
    while kill -0 $a 2>/dev/null && kill -0 $b 2>/dev/null; do sleep 1; done
    exit 1

# Unit tests: AI gateway (server/) and the knowledge module (claude/)
test: build
    npm test
    npm --prefix claude test

# End-to-end run against a variant whose server is already running: just e2e claude|codex
e2e variant="claude":
    #!/usr/bin/env bash
    set -euo pipefail
    case "{{variant}}" in
      claude) url="http://{{host}}:{{claude_port}}/" ;;
      codex)  url="http://{{host}}:{{codex_port}}/" ;;
      *) echo "unknown variant '{{variant}}' (use claude or codex)" >&2; exit 1 ;;
    esac
    KIBITZ_URL="$url" python3 claude/tests/e2e.py

# Remove build output
clean:
    rm -rf claude/dist
