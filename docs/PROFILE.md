# Player profile

TODO 9.1 adds browser-local teaching preferences under **Settings → Player profile**. Explanation level remains independent of the Stockfish strength slider. An optional rating estimate records the player's own report, its pool and time control. These values are not interchangeable ratings or a measured Kibitz Elo, and no level/rating is inferred from wins, engine accuracy or puzzle completion. Learning goals provide optional teaching context.

Level changes save immediately, preserving the previous settings behavior. Rating/goals drafts save with **Save profile**. **Reload profile** explicitly discards the form draft and reads the current saved profile. The interface supports English/German and phone widths. Saving or viewing a profile makes no provider request, changes no game/clock and adjusts no opponent strength.

## Format and persistence

`player/profile.js` validates the `kibitz.playerProfile` localStorage record:

```json
{
  "version": 1,
  "revision": 1,
  "profile": {
    "level": 2,
    "rating": {
      "value": 1500,
      "pool": "lichess",
      "timeControl": "rapid",
      "basis": "self-reported"
    },
    "goals": "Practise rook endings and avoid hanging pieces."
  }
}
```

Level is 1–4. Rating value is null (unknown) or a whole number from 0–4000; this is an input bound, not a calibration range. Pool is `unspecified`, `fide`, `national`, `lichess`, `chesscom` or `other`; time control is `unspecified`, `classical`, `rapid`, `blitz` or `bullet`. The basis is always `self-reported`. Goals are at most 500 UTF-16 characters, trimmed, well-formed Unicode without NUL. Stored envelopes are bounded to 4,096 characters, with exact known fields and bounded integer revisions. Returned values are detached.

A missing record inherits the legacy explanation level in memory, without an automatic write or inferred rating. Existing profile data takes precedence over the old settings level. Malformed, oversized or future formats remain intact and read-only. A successful single-key write precedes publication to the game/coach; quota/access failures preserve the effective profile and form draft for retry.

Writes reread the saved revision and reject stale sequential-tab edits. Storage events update effective preferences without erasing a dirty form; that draft must reload before it can overwrite a newer profile. This also applies to a level click while a stale rating/goals draft is open. localStorage does not provide a transaction across truly simultaneous writers. These are device/browser preferences, with no library migration, server upload or account sync; changing library storage does not change the profile.

## Coach boundary

Saved level controls explanation style and reference fit. Reported rating and learning goals accompany position chat, general chat, tutor comments, review summaries and study-plan requests. The form names this sharing. No requests are triggered by editing/saving the profile. Goals pass through `quote()` as bounded single-line user data and remain subordinate to app rules and live-help restrictions; they never become HTML or tool arguments. Reported ratings supply no chess evidence.

Profile identity participates in request freshness and tutor-comment cache keys. Changing preferences cancels pending dialogue/tutor work, clears future model dialogue history, and prevents stale review/study-plan responses from applying. The board and running clock remain intact. Previous visible conversations, saved summaries and local comment-cache entries remain historical records; updating the profile does not delete those records. Broader data export/deletion is TODO 10.3.

No automatic ability estimation, cross-pool conversion, weakness diagnosis or measured personalization benefit is claimed. Review-derived tracking and practice scheduling remain 9.2–9.4.
