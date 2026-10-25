# Input validation rules

These rules describe the local application's trust boundaries for ASVS v5.0.0-2.1.1.
The linked source constants remain authoritative. Text length alone does not make
content trustworthy. Model prose and imported text remain data.

| Input | Expected structure and limits | Authority and evidence |
| --- | --- | --- |
| AI requests | JSON body up to 1,000,000 bytes; supported routes/methods, roles and message structure; no client-supplied system policy; configured provider/model and privacy consent | [API](../site/server/api.mjs), [AI/schema](../site/server/ai.mjs), [gateway tests](../site/server/api.test.mjs), [boundary tests](../site/server/llm-boundaries.test.mjs) |
| Provider response | Per-operation deadline (default 60 s, maximum 15 min); raw HTTP body up to 8 MiB; decoded coaching text/tool metadata up to 128 KiB; annotation schema and bounded tools | [Limits](../site/server/provider-limits.mjs), [schema](../site/server/schema.mjs), [tests](../site/server/provider-limits.test.mjs); schema validity does not establish truthful prose |
| Embeddings | At most 16 texts of 8,000 characters, known embedding identity/dimensions, finite numeric vectors; bounded response and concurrency | [Gateway](../site/server/embeddings.mjs), [dense rules](../site/src/library/dense-search.js), [tests](../site/server/embeddings.test.mjs) |
| Moves, squares and positions | chess.js legality and position checks; engine-produced evidence for recognized lines; bounded tool depth, time, call/round counts | [Tools](../site/src/coach/tools.js), [evidence](../site/src/chess/evidence.js), [tests](../site/tests/unit/tools.test.mjs); browser checks protect local rendering/game state and are not server authorization |
| Pasted PGN | Batch up to 5,000,000 characters and 500 games; each game up to 200,000 characters and 4,000 plies; chess.js parse/position validation; source/provenance binding | [Import](../site/src/library/import.js), [tests](../site/tests/unit/pgn-import.test.mjs); there is no general server file-upload endpoint |
| Library records | Known operations/IDs, at most 500 changes, 1,000 records, 1 MiB/record, 10 MiB/batch and 20 MiB/library; UTF-8 byte counts; source title 240, author 160, URL 2,048, licence 160 characters; HTTP(S) source URLs without credentials | [Shared record rules](../site/src/library/storage.js), [source rules](../site/src/library/library.js), [server validation](../site/server/library-api.mjs), [tests](../site/server/library-api.test.mjs) |
| Library mutations | Current cookie owner, matching revision, transactional limits; server independently recompiles PGN and validates record/book fields; no automatic client-library upload | [API](../site/server/library-api.mjs), [store](../site/server/library-store.mjs), [tests](../site/server/library-store.test.mjs); client validation is for usability |
| Model files and paths | Fixed catalogue filenames, expected byte size and SHA-256; bounded total download deadline; verification before atomic publication; private/no-symlink file boundaries | [Downloader](../site/scripts/download-model.mjs), [tests](../site/tests/unit/download-model.test.mjs), [public descriptors](../site/server/public-files.mjs) |

Reject malformed/security-relevant input before provider calls or persistent writes.
The server owns consent checks, spending/rate admission, record ownership and storage
limits. Client cookies identify opaque local groups rather than signed-in users.
Direct non-browser clients on the trusted machine remain within the operator boundary.
AI writes compare the full Origin against the native socket scheme/host and ignore
forwarding headers. Direct local clients without Origin remain within the operator boundary.

Imported notes, PGN comments and library text reach prompts through
[`quote()`](../site/src/coach/prompt.js). Safe text rendering, JSON serialization,
URL scheme checks and parameterized SQL apply at their separate output boundaries.
Neither quoting nor schema validation guarantees model obedience or factual accuracy.
