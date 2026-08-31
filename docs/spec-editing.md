# Spec: Editing

Status: **design only, not implemented**.

Scope note: earlier drafts of this spec also covered future-scheduled
matches, tournament brackets, and a persistent `Team` entity. All three are
cut. Scheduling and brackets don't exist in the paper score sheet this app
is digitizing (no "TBD" match, no playoff structure). `Team` was removed
from the data model entirely (see `CLAUDE.md`) — a match's two sides are now
picked fresh from the league's player pool each time, with an optional
free-text label per side. What's left here is a plain edit/delete pass on
the entities that actually exist: League, Player, Match.

## What's editable, and the one real wrinkle

| Entity | Fields | Notes |
|---|---|---|
| League | name | Delete cascades to its Players/Matches — needs a real confirm step (e.g. type the league's name), not just a button. |
| Player | name, handicap | Delete removes them from any Pairing they're part of (see wrinkle below). |
| Match | date, homeLabel/awayLabel, lineup (3 players/side), game scores | Scores are already editable today. Date and labels are plain field edits. Lineup is the wrinkle. |

**The wrinkle:** a Match's lineup determines its round-robin pairing
schedule (`Round`/`Pairing` rows, generated once at creation via
`awayIndexForRound`). Editing the lineup after scores exist means those
pairings — and whatever scores were entered against them — no longer make
sense. Same problem, smaller scale, if a player is edited/deleted while
they're part of an existing match's lineup.

Resolution: editing a Match's lineup **regenerates its Rounds/Pairings from
scratch** (same logic `createMatch` already uses), and if any scores had
been entered, the edit UI warns "this will erase entered scores for this
match" before doing it. No partial-preservation logic (e.g. trying to carry
over a score if the same two players happen to still be paired) — not worth
the complexity for how rarely a lineup gets corrected after scoring has
started.

Deleting a player who's on an existing match's lineup: block the delete
with a clear message ("SATCH is in an active match — remove them from that
match first") rather than silently cascading into a broken Pairing. Simple
and safe; a "force delete and drop their matches" escape hatch can wait
until someone actually hits this.

## New routes (additive to the existing `/leagues/[leagueId]/...` tree)

```
/leagues/[leagueId]/edit                    — rename league, delete (with confirm)
/leagues/[leagueId]/players/[playerId]/edit — rename player, edit handicap, delete (blocked if in an active match)
/leagues/[leagueId]/matches/[matchId]/edit  — edit date/labels/lineup (with the regenerate-and-warn behavior above)
```

Score editing needs no new route — it already works on the existing match
page.

## Server actions needed (in `src/lib/actions.ts`)

- `updateLeague(leagueId, formData)`, `deleteLeague(leagueId)`
- `updatePlayer(playerId, formData)`, `deletePlayer(playerId)` (blocked if
  the player is in a match's lineup, per above)
- `updateMatch(matchId, formData)` — date/labels always; lineup regenerates
  Rounds/Pairings when changed
- `deleteMatch(matchId)`

## Prisma schema changes

None beyond what's already in place. This is pure CRUD against the existing
model — no new fields, no lifecycle/status. The only schema-adjacent change
is adding `onDelete: Cascade` on the relations that need it (League →
Player, League → Match, Match → Round, Round → Pairing) so deletes don't
have to be hand-orchestrated in application code.
