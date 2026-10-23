# Kibitz: build, serve and test the site.
#   just serve         build and serve site/ with the AI coach on :8765
#   just offline       the same, with a small model running in the browser: nothing leaves this machine
#   just test          unit tests (AI gateway + page modules)
#   just check         lint and type-check
#   just flipbook      render docs/flipbook/, a happy path through the app in screenshots
#   just pdfs          a PDF next to every Markdown document (just pdf FILE for one)
#   just eval          the tutor eval set against the coach, with a report in docs/eval/
#   just retrieval-eval   position/text benchmarks; dense/hybrid explicitly call an embedding provider
# Port and bind address can be overridden: KIBITZ_PORT=9000 just serve

port := env_var_or_default("KIBITZ_PORT", "8765")
host := env_var_or_default("KIBITZ_HOST", "127.0.0.1")

# List recipes
default:
    @just --list

# Install site/ dependencies (skipped if already installed)
install:
    @[ -d site/node_modules ] || npm --prefix site ci

# Build site/ into site/dist
build: install
    npm --prefix site run build

# Rebuild the opening table (site/dist/eco.json)
build-eco: install
    npm --prefix site run build:eco

# site/dist/index.html is the bare artifact body (no <head>), so "/" serves the full-document _test.html.
# A model downloaded by `just offline` is offered too, as "In browser" in the coach settings.
# Build and serve the site with the AI gateway, configured from .env (see .env.example).
serve: build
    node site/scripts/serve.mjs site/dist --api --env .env --models site/models --index _test.html --port {{port}} --host {{host}}

# The coach runs a small model in the browser (WebGPU, or WebAssembly on the CPU). The first run
# downloads it into site/models/ and checks its SHA-256 (about 1.1 GB; `just offline qwen2.5-0.5b`
# for a 0.5 GB one). Then it serves without .env keys, in local-only mode, and the page requests
# nothing from other hosts (TODO 2.16).
# Offline mode: serve with the in-browser model; nothing leaves this machine
offline model="": build
    BROWSER_MODEL={{model}} node site/scripts/fetch-model.mjs
    AI_PROVIDER=browser AI_LOCAL_ONLY=1 BROWSER_MODEL={{model}} node site/scripts/serve.mjs site/dist --api --env= --models site/models --offline --index _test.html --port {{port}} --host {{host}}

# Lint (ESLint) and type-check (tsc --checkJs)
check: install
    npm --prefix site run check

# Unit tests: AI gateway (site/server) and page modules (site/src)
test: build
    npm --prefix site test

# End-to-end Playwright tests in the installed Chrome; builds, then starts its own server with the mock AI provider
e2e: install
    npm --prefix site run test:e2e

# The reference positions in site/eval/positions.mjs, asked through the app, scored on key points and
# the app's move checks, and with judge=<provider> graded by an LLM (keys stay on this machine).
# ai: env (as `just serve`), mock, anthropic, openai, mistral, ollama, or browser (model=qwen2.5-0.5b
# for the smaller in-browser model). The models are the ones in .env; EVAL_JUDGE_MODEL picks the judge's.
# With a paid provider it prints the models and the number of calls and stops: yes=1 runs it.
# Run the tutor eval set (TODO 3.8); writes docs/eval/
eval ai="env" judge="none" model="" yes="": build
    node site/scripts/eval.mjs --ai {{ai}} --judge {{judge}} {{ if model != "" { "--model " + model } else { "" } }} {{ if yes != "" { "--yes" } else { "" } }}

# Labelled retrieval benchmark; position/text are offline, dense/hybrid explicitly call a provider
retrieval-eval *args: install
    node utils/retrieval-eval.mjs {{args}}

# Each step of site/flipbook/tour.mjs is played in a headless Chrome and captured into docs/flipbook/.
# The coach uses the provider and models in .env, as `just serve` does; `just flipbook mock` needs no keys.
# With a paid provider it prints the models and the number of calls and stops: yes=1 renders it.
# Render docs/flipbook/: a happy path through the app, one screenshot per step
flipbook ai="env" yes="": build
    node site/scripts/flipbook.mjs --ai {{ai}} {{ if yes != "" { "--yes" } else { "" } }}
# --- Documents: Markdown → PDF (adapted from the OrgFab repo) ------------------------------------
# pandoc (Markdown → standalone HTML, images and scripts embedded, math as MathML) + headless Chrome
# (HTML → A4 PDF), typography from utils/pdf/style.css. Documents with ```mermaid blocks get
# utils/pdf/mermaid.html, which draws the diagrams (pandoc downloads Mermaid once per build).
# Needs `brew install pandoc` and Google Chrome (CHROME=/path/to/chrome to use another).
# Incremental: .pdfstamps/ records a hash of (source + build inputs) and of the PDF produced, so an
# unchanged file is skipped; images are not hashed: after editing only an image, delete the PDF.

chrome   := env_var_or_default("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
css      := justfile_directory() / "utils/pdf/style.css"
mermaid  := justfile_directory() / "utils/pdf/mermaid.html"
stampdir := justfile_directory() / ".pdfstamps"

# The PDF keeps the source's full name (foo.md.pdf), so .gitignore can tell generated PDFs from others.
# PDF next to a Markdown file, e.g. docs/ARCH.md → docs/ARCH.md.pdf
pdf file:
    #!/usr/bin/env bash
    set -euo pipefail
    src="{{file}}"
    case "$src" in *.md) ;; *) echo "ERROR: not a .md file: $src" >&2; exit 2 ;; esac
    dir="$(cd "$(dirname "$src")" && pwd)"
    base="$(basename "$src")"
    out="$dir/$base.pdf"
    # Rebuild only outdated PDFs. The content stamp is a hash of (source + build inputs) and of the
    # PDF that build produced: it survives the mtime scrambling of git checkout and pull, and both
    # halves matter, since git can replace the PDF under an unchanged source. Without a stamp (a
    # fresh clone), a PDF newer than its source and the build inputs is adopted as current.
    mkdir -p "{{stampdir}}"
    hash="$(cat "$src" "{{css}}" "{{mermaid}}" | shasum -a 256 | cut -d' ' -f1)"
    stamp="{{stampdir}}/$(printf '%s' "$out" | shasum -a 256 | cut -c1-16).sha"
    if [ -f "$out" ]; then
        outhash="$(shasum -a 256 "$out" | cut -d' ' -f1)"
        if [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$hash $outhash" ]; then
            echo "up to date: $out"; exit 0
        fi
        if [ ! -f "$stamp" ] && [ "$out" -nt "$src" ] && [ "$out" -nt "{{css}}" ] && [ "$out" -nt "{{mermaid}}" ]; then
            printf '%s %s\n' "$hash" "$outhash" > "$stamp"
            echo "up to date: $out"; exit 0
        fi
    fi
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    extra=()
    if grep -q '^```mermaid' "$src"; then extra=(--include-in-header "{{mermaid}}"); fi
    # --resource-path: images are relative to the source file's directory.
    pandoc "$src" -f gfm+tex_math_dollars -o "$tmp/doc.html" --standalone --embed-resources --mathml \
        --resource-path "$dir" --css "{{css}}" --metadata pagetitle="$base" ${extra[@]+"${extra[@]}"}
    # Chrome headless sometimes finishes the PDF but never exits: run it in the background, wait for
    # the output file (or for it to exit), then stop it.
    "{{chrome}}" --headless --disable-gpu --no-first-run --no-default-browser-check --disable-extensions \
        --virtual-time-budget=15000 --timeout=20000 --user-data-dir="$tmp/chrome-profile" \
        --no-pdf-header-footer --print-to-pdf="$tmp/out.pdf" "$tmp/doc.html" >"$tmp/chrome.log" 2>&1 &
    pid=$!
    done=""
    for _ in $(seq 1 120); do                          # up to about 60 s
        if ! kill -0 "$pid" 2>/dev/null; then done=1; break; fi
        if [ -s "$tmp/out.pdf" ]; then                 # the PDF appeared: wait until its size is stable
            s1=$(wc -c < "$tmp/out.pdf"); sleep 0.5; s2=$(wc -c < "$tmp/out.pdf" 2>/dev/null || echo 0)
            if [ "$s1" = "$s2" ]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; done=1; break; fi
        fi
        sleep 0.5
    done
    if [ -z "$done" ]; then kill -9 "$pid" 2>/dev/null || true; echo "ERROR: Chrome timed out after 60 s" >&2; cat "$tmp/chrome.log" >&2; exit 1; fi
    if [ ! -s "$tmp/out.pdf" ]; then echo "ERROR: Chrome produced no PDF" >&2; cat "$tmp/chrome.log" >&2; exit 1; fi
    mv "$tmp/out.pdf" "$out"
    printf '%s %s\n' "$hash" "$(shasum -a 256 "$out" | cut -d' ' -f1)" > "$stamp"
    echo "wrote $out"

# Default: every Markdown file in the repo (tracked or new, not ignored), except CLAUDE.md (it only
# points at AGENTS.md) and .github/ (templates).
# PDF for every Markdown file under PATHS, e.g. `just pdfs docs`
pdfs *PATHS:
    #!/usr/bin/env bash
    set -uo pipefail
    cd "{{justfile_directory()}}"
    fail=0
    while IFS= read -r f; do
        echo "── $f"
        just pdf "$f" || { echo "FAILED: $f" >&2; fail=1; }
    done < <(git ls-files --cached --others --exclude-standard -- {{PATHS}} \
             | grep -E '\.md$' | grep -v '\(^\|/\)CLAUDE\.md$' | grep -v '^\.github/')
    exit $fail

# Remove build output
clean:
    rm -rf site/dist
