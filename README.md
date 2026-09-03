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
2. **Teams** (`/leagues/[id]`, `/leagues/[id]/teams/[teamId]`) — create a
   team, then add its players with their handicap. Every player belongs to
   exactly one team.
3. **New match** (`/leagues/[id]/matches/new`) — pick two teams and a table
   count, then a home/away player per table from each team's roster.
4. **Match scoring** (`/leagues/[id]/matches/[matchId]`) — enter each
   player's Game 1 / Game 2 scores. The app automatically generates the
   round-robin pairing schedule and computes each round's handicap-adjusted
   score live, same as the paper sheet used to require by hand.

See `CLAUDE.md` for the data model and the scoring rules that were
reverse-engineered from real filled-in score sheets (including one rule that
still needs confirming with the league).

## Stack

Next.js (App Router, TypeScript, Tailwind) + SQLite via Prisma. No auth —
built for one league's own use.
