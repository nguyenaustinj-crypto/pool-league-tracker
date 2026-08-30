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
Venue → Team → Player, and Match (homeTeam vs awayTeam) → Round (x3) → Pairing (one home player vs one away player, 2 games/racks each).

## Scoring rules (`src/lib/scoring.ts`)
Reverse-engineered from real filled-in copies of the paper "Bonus Score Sheet" (see the `Billardscoresheet-*` folder) and verified against real numbers from 3 separate rounds:
- Round-robin pairing: across a match's 3 rounds, each of a team's 3 lineup players faces each of the opponent's 3 lineup players exactly once.
- The team with the lower total handicap gets a bonus added to their score subtotal, equal to the handicap gap between the two teams, doubled and rounded to the nearest whole number. Verified exactly against 3 real rounds.
- UNCONFIRMED: the sheet has a "Bonus over 22" rule for when a team's handicap total exceeds the league's 22 cap. Sample data never triggered a nonzero value there, so it currently contributes 0 — see the `bonusOverCap()` comment in `scoring.ts`. Confirm the real rule with the league before relying on match results near that cap.

## Status
V1 built: team/player rosters (with handicaps) and match entry with auto-computed round-robin pairings and live score calculation, replacing the paper sheet itself. Not yet built: season standings, multi-venue scheduling, editing/deleting teams or matches.
