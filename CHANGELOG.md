# Changelog

Notable user-facing changes are collected here. Detailed implementation history
and verification notes are in [DONE.md](docs/DONE.md). Versions follow the
[project release policy](docs/RELEASING.md) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The existing package value `0.1.0` is the development baseline. No published
release or historical release date is inferred from it; the entries below are
unreleased until a release PR names and verifies a specific version/commit.

## [Unreleased]

### Added

- Local single-user chess coach with Stockfish play/measurement, optional Claude,
  OpenAI, Mistral or Ollama explanations, and bounded engine tools in the browser.
- Browser inference through a local GGUF runtime or Chrome's optional built-in
  model, plus explicit model loading and an offline app preparation/update flow.
- Personal PGN libraries and optional cookie-separated SQLite server storage,
  source/licence metadata, exact position and structural retrieval, text search
  and optional dense/hybrid ranking with source navigation.
- Game reviews, turning-point navigation, player preferences, own-mistake
  exercises, opening repertoires, lessons and browser-local spaced practice.
- English/German UI and study notes, configurable move notation, keyboard board
  controls and phone/tablet layouts. The [flipbook](docs/flipbook/README.md) shows
  nineteen current-interface steps with recorded coaching provenance.
- Purpose-specific provider permissions, separate browser/server export/erasure,
  persistent local usage accounting and private operator diagnostics.
- Documented threat model, OWASP application/LLM reviews and versioned ASVS L1
  assessment with evidence and explicit remaining requirements.

### Fixed

- Reorganized browser source into domain directories with build-preserved module
  paths and verified imports.
- Keep imported/model text literal, validate recognized chess lines and reject
  stale asynchronous results across game/library/session changes.
- Bound model/fixture downloads and provider operations, including partial
  streamed/error bodies, hidden fields and tool metadata. Public provider errors
  use fixed hints instead of reflecting provider-controlled diagnostics.
- Serve static/model bytes through checked file descriptors, reject hidden and
  symlink paths, and derive CSP hashes from parsed authored HTML.
- Compare AI write Origins with native scheme/host, preserve direct local clients
  and declare UTF-8 for SVG. Native TLS grouping cookies receive Secure.

### Security

- Permit trusted hashed stylesheets and block style attributes, preserving dynamic
  board geometry. Original fonts and their licences now ship locally in normal
  and offline pages, removing the external font stylesheet and its metadata
  requests. The public offline bundle grows by about 790 KB of font data.

### Compatibility and current limits

- The supported deployment is local and single-user. Cookie groups do not provide
  authenticated accounts; existing saved data and private library cookies need
  deliberate migration decisions before incompatible changes.
- External providers require explicit sharing permission and working operator
  configuration. Aborting requests and usage admission thresholds are not hard
  provider billing caps. Cloud/model identifiers may change upstream.
- Engine/legal-move/citation checks cover recognized evidence; arbitrary chess
  prose can remain wrong. Retrieval comparisons and cue counts do not certify
  teaching quality or general chess understanding.
- Security reviews retain deployment deviations and incomplete verification.
  A feature PR, passing scanner or this changelog does not grant release approval.

[Unreleased]: https://github.com/gregoryyy/kibitz/commits/main/
