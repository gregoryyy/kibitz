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

# Install claude/ dependencies (skipped if already installed)
install:
    @[ -d claude/node_modules ] || npm --prefix claude ci

# Build claude/ into claude/dist
build: install
    npm --prefix claude run build

# Rebuild the opening table (claude/dist/eco.json)
build-eco: install
    npm --prefix claude run build:eco

# Build and serve the claude/ variant
claude: build
    @echo "claude → http://{{host}}:{{claude_port}}/_test.html"
    cd claude/dist && python3 -m http.server {{claude_port}} --bind {{host}}

# Serve the codex/ variant (no build step)
codex:
    @echo "codex  → http://{{host}}:{{codex_port}}/"
    cd codex && python3 -m http.server {{codex_port}} --bind {{host}}

# Serve both variants side by side; Ctrl-C stops both
both: build
    #!/usr/bin/env bash
    set -euo pipefail
    trap 'kill $(jobs -p) 2>/dev/null || true' EXIT
    (cd claude/dist && exec python3 -m http.server {{claude_port}} --bind {{host}}) &
    (cd codex && exec python3 -m http.server {{codex_port}} --bind {{host}}) &
    echo "claude → http://{{host}}:{{claude_port}}/_test.html"
    echo "codex  → http://{{host}}:{{codex_port}}/"
    wait

# Unit check of the knowledge module
test: build
    npm --prefix claude test

# End-to-end run against a variant whose server is already running: just e2e claude|codex
e2e variant="claude":
    #!/usr/bin/env bash
    set -euo pipefail
    case "{{variant}}" in
      claude) url="http://{{host}}:{{claude_port}}/_test.html" ;;
      codex)  url="http://{{host}}:{{codex_port}}/" ;;
      *) echo "unknown variant '{{variant}}' (use claude or codex)" >&2; exit 1 ;;
    esac
    KIBITZ_URL="$url" python3 claude/tests/e2e.py

# Remove build output
clean:
    rm -rf claude/dist
