# Kibitz: build, serve and test the site.
#   just serve         build and serve site/ with the AI coach on :8765
#   just test          unit tests (AI gateway + knowledge module)
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

# Build and serve the site with the AI gateway, configured from .env (see .env.example).
# site/dist/index.html is the bare artifact body (no <head>), so "/" serves the full-document _test.html.
serve: build
    node site/scripts/serve.mjs site/dist --api --env .env --index _test.html --port {{port}} --host {{host}}

# Unit tests: AI gateway (site/server) and knowledge module
test: build
    npm --prefix site test

# End-to-end Playwright tests in the installed Chrome; builds, then starts its own server with the mock AI provider
e2e: install
    npm --prefix site run test:e2e

# Remove build output
clean:
    rm -rf site/dist
