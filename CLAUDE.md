# Pool League Tracker

A web app to replace paper-based tracking for pool leagues across multiple venues/locations.

## Goal
- Start as a simple web app, usable from a phone browser.
- Eventual target: a proper mobile app.
- Replaces manual/paper tracking of league standings, matches, and scores at each location.

## Stack
- Next.js (App Router, TypeScript, Tailwind) — one deployable app, works well on a phone browser now, can be wrapped for a native app later.
- SQLite via Prisma (driver adapter: `@prisma/adapter-better-sqlite3`, required by Prisma 7's client generator — see `src/lib/prisma.ts`).
- No auth — this is for one family/league's own use.

## Data model (`prisma/schema.prisma`)
League → Team → Player, and Match (homeTeam vs awayTeam, both must belong to the same league) → Round (x3) → Pairing (one home player vs one away player, 2 games/racks each). Venue exists as an optional, independent attachment on Team (not league-scoped) but has no UI yet.

Routes are nested under `/leagues/[leagueId]/...` so teams and matches are always viewed/created in the context of one league; a match's two teams are validated server-side to belong to the same league.

## Scoring rules (`src/lib/scoring.ts`)
Reverse-engineered from real filled-in copies of the paper "Bonus Score Sheet" (see the `Billardscoresheet-*` folder) and verified against real numbers from 3 separate rounds:
- Round-robin pairing: across a match's 3 rounds, each of a team's 3 lineup players faces each of the opponent's 3 lineup players exactly once.
- The team with the lower total handicap gets a bonus added to their score subtotal, equal to the handicap gap between the two teams, doubled and rounded to the nearest whole number. Verified exactly against 3 real rounds.
- UNCONFIRMED: the sheet has a "Bonus over 22" rule for when a team's handicap total exceeds the league's 22 cap. Sample data never triggered a nonzero value there, so it currently contributes 0 — see the `bonusOverCap()` comment in `scoring.ts`. Confirm the real rule with the league before relying on match results near that cap.

## Status
V1 built: leagues, team/player rosters (with handicaps) within a league, and match entry (teams restricted to the same league) with auto-computed round-robin pairings and live score calculation, replacing the paper sheet itself. Not yet built: season standings, multi-venue scheduling, editing/deleting leagues, teams, players, or matches.

## Future ideas (not started — get the core app solid first)
- **User accounts + per-league permissions.** People log in, and roles control who can edit a given league's settings/rosters/scores vs. just view them. Real complexity here (login, sessions, password/OAuth) — hold off until there's an actual need for multiple people to independently edit the same league.
- **Weekly email reminder of the schedule.** Separate concern from accounts — just needs an email address on file per player (a lightweight field, not a login), a way to query "matches coming up this week," an email-sending service (e.g. Resend) with an API key, and a scheduled trigger. The app isn't deployed/running 24/7 anywhere yet, which is the real blocker for this — needs a hosting decision first.
