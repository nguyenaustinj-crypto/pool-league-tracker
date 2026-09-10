# Pool League Tracker

A mobile-friendly web app that replaces the paper "Bonus Score Sheet" used to
track pool league matches.

## Getting started

```bash
npm install
cp .env.example .env
```

Then put the real database URL in `.env` (see `.env.example` for where to
find it) and start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — works great from a phone
browser too.

> **Heads up:** local dev and the live site currently share one database, so
> anything you create while developing shows up on the real site. Clean up
> test data after yourself.

On Windows PowerShell, use `npm.cmd run dev` if `npm run dev` is blocked by
the execution policy.

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

5. **Standings** (`/leagues/[id]`) — round wins, losses, ties and points per
   team, tallied across every match in the league.

See `CLAUDE.md` for the data model and the scoring rules that were
reverse-engineered from real filled-in score sheets (including one rule that
still needs confirming with the league), and `docs/league-rules/` for the
league's own written rules.

## Checks

```bash
npm test          # scoring + standings math
npm run typecheck
npm run lint
```

The scoring and standings tests pin real numbers from the league's paper
sheet and written rules. If you change that math, they're supposed to fail —
update the formula and the expected values together.

## Stack

Next.js (App Router, TypeScript, Tailwind) + Postgres via Prisma, deployed on
Vercel. No auth — built for one league's own use.
