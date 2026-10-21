# Kibitz: build, serve and test the site.
#   just serve         build and serve site/ with the AI coach on :8765
#   just offline       the same, with a small model running in the browser: nothing leaves this machine
#   just test          unit tests (AI gateway + page modules)
#   just check         lint and type-check
#   just flipbook      render docs/flipbook/, a happy path through the app in screenshots
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

# Each step of site/flipbook/tour.mjs is played in a headless Chrome and captured into docs/flipbook/.
# The coach uses the provider in .env, as `just serve` does (a few requests); `just flipbook mock` needs no keys.
# Render docs/flipbook/: a happy path through the app, one screenshot per step
flipbook ai="env": build
    node site/scripts/flipbook.mjs --ai {{ai}}

# Remove build output
clean:
    rm -rf site/dist
