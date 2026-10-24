# Spaced practice

TODO 9.4 adds **Lessons → Spaced practice**. It combines authored lessons/sourced curriculum puzzles, saved opening recalls and exercises from the selected library's own-game mistakes. The queue shows the oldest due reviews first, followed by new exercises, up to 20 items. Filters select the practice type and whether to include new exercises. Refresh updates time-dependent due dates; the visible panel also refreshes once a minute.

New lesson exercises follow the profile's explanation-level ceiling. Already scheduled current exercises remain available if the level is lowered. This is a browsing preference, not estimated ability or automatic difficulty calibration. Individual lesson browsing remains available independently.

Each queue action opens its existing independent player. It leaves the main game, clock and library unchanged. Opening recall opens the chosen current repertoire card, and own-game practice searches its current target afresh. Restricted live help hides the queue. Game generation, library scope, source identity, repertoire revision and current panel guards reject held actions. Focused opening/lesson/practice boards do not send navigation or flip keys to the main board.

## Intervals and evidence

All three types use the existing deterministic opening-drill intervals, without another dependency or a fitted memory model:

| Completed result | Next interval |
| --- | --- |
| Miss, reveal or reflection assessed “more practice” | 10 minutes |
| Help used, without a miss/reveal | At least one day; retain an existing longer interval, capped at 180 days |
| Clean completion | One day, then three days, then double the preceding interval, capped at 180 days |

Every opening recall retains its existing saved-choice criterion: a legal alternative outside the repertoire is a recall miss, not a verdict on its chess quality. Lesson mate, recorded-line recall and rubric self-assessment keep their original criteria. Own-game exercises retain the [bounded engine target](OWN-PUZZLES.md), with actual mate distinguished from engine evidence. Unknown engine evidence and illegal input do not produce a completed scheduling receipt. Assistance/reveal affects the interval without becoming independent-solve credit.

The queue names the last evidence class. A self-assessed reflection remains a self-assessment; none of these intervals or counters is a rating, calibrated retention estimate or proof of mastery. Written reflection responses are not stored in the scheduler.

## Current source identity

- Lessons use stable exercise IDs and the exact task revision already used by [lesson progress](ARCH.md). Changing the diagram, line, prompt or rubric starts a separate schedule while retaining old data.
- Opening reviews keep their existing key: repertoire, side, EPD and sorted accepted choices. Renaming notes does not reset recall; removed positions/changed choices do not borrow old credit.
- Own exercises bind the selected library owner, source occurrence/full FEN/actual move, opaque generated ID and checked engine-target policy revision. The queue uses the latest known target for a surviving current candidate. Opening it always prepares it afresh. A changed freshly checked target starts a separate schedule on completion; an unsupported old mistake cannot receive a new grade.

The own-game queue uses the player's existing bounded candidate deck (up to 50 current mistakes). It does not search every game in the background or certify stored engine targets. Deleting/replacing a source, changing library owners or removing a compatible report removes its queue pointer. Historical schedule entries remain in local storage but are not shown as surviving source exercises.

## Acknowledgement, retries and storage

`player/schedule.js` stores a bounded, versioned `kibitz.practiceSchedule` localStorage envelope for lesson and own-game schedules. `player/schedule-ui.js` renders the combined queue as text. Opening schedules remain in `kibitz.repertoireReviews`, without migration or duplicate writes. Browser-local lesson progress remains in its separate existing store.

A lesson result enters scheduling only after lesson progress acknowledges it. These are two separate localStorage writes, with no cross-key transaction claim. If scheduling then fails, the saved lesson result remains valid and a distinct scheduling receipt waits in the tab. Closing/reloading before that receipt is saved loses the pending scheduling update. The same applies to a failed own-exercise schedule save; its engine/rules result remains visible, alongside a retry control. Pending lesson schedule saves remain visible even when live-help policy hides the queue.

Retry receipts have bounded completion IDs so acknowledged lesson/own results are not counted again within the recent-ID window. Stores reread before a write to preserve sequential tab activity. A late older receipt does not move a newer due date backwards. Storage events refresh displayed schedules; corrupt, oversized or future-format envelopes remain intact and read-only. A failed write publishes no optimistic result. This does not provide a transaction between genuinely simultaneous localStorage writers.

The envelope is bounded to 4,000 lesson/own revision entries, 2,048 recent receipt IDs and eight million characters. Hitting a limit preserves existing data and leaves an unsaved receipt for retry; no history is silently evicted. Dates follow the local system clock. There is no sign-in, cross-device sync, server upload, notification or background provider request. This milestone schedules completed practice from now on; it does not invent historical intervals from old lesson totals.
