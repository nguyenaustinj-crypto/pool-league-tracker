# Spec: Editing

Status: **implemented.**

Scope note: earlier drafts of this spec also covered future-scheduled
matches and tournament brackets. Both are cut — scheduling and brackets
don't exist in the paper score sheet this app is digitizing (no "TBD"
match, no playoff structure). `Team` *was* removed from the data model at
one point (see `CLAUDE.md`) with a match's two sides picked fresh from the
league's flat player pool each time, but it has since been reintroduced as
a required, persistent entity — see `CLAUDE.md`'s Data model section for
why. What's left here is a plain edit/delete pass on the entities that
actually exist: League, Team, Player, Match.

## What's editable, and the one real wrinkle

| Entity | Fields | Notes |
|---|---|---|
| League | name | Delete cascades to its Teams/Players/Matches — needs a real confirm step (e.g. type the league's name), not just a button. |
| Team | name | Delete cascades to its Players — blocked if the team has played in an existing match (see wrinkle below). |
| Player | name, handicap | Delete removes them from any Pairing they're part of (see wrinkle below). |
| Match | date, homeTeam/awayTeam, lineup (1 player/side/table), game scores | Scores are already editable today. Date is a plain field edit. Team and lineup are the wrinkle. |

**The wrinkle:** a Match's lineup determines its round-robin pairing
schedule (`Round`/`Pairing` rows, generated once at creation via
`awayIndexForRound`). Editing the team or the lineup after scores exist
means those pairings — and whatever scores were entered against them — no
longer make sense. Same problem, smaller scale, if a player is
edited/deleted while they're part of an existing match's lineup, or if a
team is deleted while it's played in an existing match.

Resolution: editing a Match's team or lineup **regenerates its
Rounds/Pairings from scratch** (same logic `createMatch` already uses), and
if any scores had been entered, the edit UI warns "this will erase entered
scores for this match" before doing it. No partial-preservation logic (e.g.
trying to carry over a score if the same two players happen to still be
paired) — not worth the complexity for how rarely a lineup gets corrected
after scoring has started.

Deleting a player who's on an existing match's lineup: block the delete
with a clear message ("SATCH is in an active match — remove them from that
match first") rather than silently cascading into a broken Pairing. Same
idea for deleting a team that's played a match — block with a message
rather than cascading into an orphaned Match. Simple and safe; a "force
delete and drop their matches" escape hatch can wait until someone actually
hits this.

## New routes (additive to the existing `/leagues/[leagueId]/...` tree)

```
/leagues/[leagueId]/edit                    — rename league, delete (with confirm)
/leagues/[leagueId]/teams/[teamId]          — team roster: add players, rename team, delete (blocked if in a match)
/leagues/[leagueId]/players/[playerId]/edit — rename player, edit handicap, delete (blocked if in an active match)
/leagues/[leagueId]/matches/[matchId]/edit  — edit date/teams/lineup (with the regenerate-and-warn behavior above)
```

Score editing needs no new route — it already works on the existing match
page.

## Server actions needed (in `src/lib/actions.ts`)

- `updateLeague(leagueId, formData)`, `deleteLeague(leagueId)`
- `createTeam(leagueId, formData)`, `updateTeam(leagueId, teamId, formData)`,
  `deleteTeam(leagueId, teamId)` (blocked if the team has played in a match)
- `createPlayer(leagueId, teamId, formData)`,
  `updatePlayer(leagueId, playerId, formData)`,
  `deletePlayer(leagueId, playerId)` (blocked if the player is in a match's
  lineup, per above)
- `updateMatch(leagueId, matchId, formData)` — date always; team/lineup
  regenerates Rounds/Pairings when changed
- `deleteMatch(leagueId, matchId)`

## Prisma schema changes

`Team` was reintroduced as a required model between League and Player (see
`CLAUDE.md`'s Data model section) — `Player.teamId` is required, and
`Match.homeTeamId`/`awayTeamId` replace the old free-text
`homeLabel`/`awayLabel`. `onDelete: Cascade` is set on every relation that
needs it (League → Team, Team → Player, League → Match, Match → Team,
Match → Round, Round → Pairing) so deletes don't have to be
hand-orchestrated in application code — app-level guards in `actions.ts`
are what actually stop a delete that would orphan live match data; the
cascades are the fallback once a whole League is being torn down.
