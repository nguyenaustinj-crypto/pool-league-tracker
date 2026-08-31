# Pool League Tracker

A mobile-friendly web app that replaces the paper "Bonus Score Sheet" used to
track pool league matches.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — works great from a phone
browser too.

## What it does

1. **Leagues** (`/`) — create a league. Everything else lives inside one.
2. **Players** (`/leagues/[id]`) — add each player to the league with their
   handicap. No separate "team" to set up first — players just belong to
   the league.
3. **New match** (`/leagues/[id]/matches/new`) — pick any 3 players vs any
   other 3 players from that league's pool for tonight's match, with an
   optional team-name label for each side (matches the paper sheet's blank
   team-name field; if you skip it, the side is just identified by its 3
   players).
4. **Match scoring** (`/leagues/[id]/matches/[matchId]`) — enter each
   player's Game 1 / Game 2 scores. The app automatically generates the
   3-round round-robin pairing schedule and computes each round's
   handicap-adjusted score live, same as the paper sheet used to require by
   hand.

See `CLAUDE.md` for the data model and the scoring rules that were
reverse-engineered from real filled-in score sheets (including one rule that
still needs confirming with the league).

## Stack

Next.js (App Router, TypeScript, Tailwind) + SQLite via Prisma. No auth —
built for one league's own use.
