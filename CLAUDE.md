# Pool League Tracker

A web app to replace paper-based tracking for pool leagues across multiple venues/locations.

## Goal
- Start as a simple web app, usable from a phone browser.
- Eventual target: a proper mobile app.
- Replaces manual/paper tracking of league standings, matches, and scores at each location.

## Stack
- Next.js (App Router, TypeScript, Tailwind) — one deployable app, works well on a phone browser now, can be wrapped for a native app later.
- Postgres via Prisma (driver adapter: `@prisma/adapter-pg`, required by Prisma 7's client generator — see `src/lib/prisma.ts`). Was SQLite locally; switched to Postgres (Prisma Postgres, via Vercel's storage integration) once deployment needed a database that survives serverless hosting's ephemeral filesystem.
- `prisma.config.ts` reads `DIRECT_URL ?? DATABASE_URL` for CLI/migration commands; the app itself reads `DATABASE_URL` via the pg adapter. `npm run build` runs `prisma migrate deploy` before `next build`, so migrations apply automatically on every Vercel deploy — no manual migration step, and no one ever needs to paste the database password anywhere.
- Hosting: Vercel, connected to the `nguyenaustinj-crypto/pool-league-tracker` GitHub repo. Database: Prisma Postgres (single database — no separate dev/prod split yet, see caveat below).
- No auth — this is for one family/league's own use.

**Caveat on the shared database:** local dev and the deployed app currently point at the *same* Prisma Postgres database (via the same `DATABASE_URL`). There's no separate dev database yet. Any local testing that writes data should clean up after itself (delete what you created) so it doesn't show up for real users of the deployed app.

## Data model (`prisma/schema.prisma`)
League → Player (a flat roster, no persistent Team entity), and Match (belongs to a League) → Round (x3) → Pairing (one home player vs one away player, 2 games/racks each). A match's two sides are picked fresh each time from the league's player pool at match-creation time — 3 players per side, validated server-side to belong to the same league and not overlap. Each side optionally has a free-text `homeLabel`/`awayLabel` (mirrors the paper sheet's blank team-name field); when absent, the UI falls back to listing that side's player names (`src/lib/format.ts`).

There used to be a `Team` model sitting between League and Player, with its own name/roster and its own page. It was deliberately removed — see git history (`git log --oneline -- prisma/schema.prisma`) around the "Player in league" commit — in favor of the flatter model above. If a persistent, named team concept comes back later (see Future ideas), it should slot in as an optional grouping over the existing Player pool rather than a required layer every player must belong to.

Routes are nested under `/leagues/[leagueId]/...` so players and matches are always viewed/created in the context of one league.

## Scoring rules (`src/lib/scoring.ts`)
Reverse-engineered from real filled-in copies of the paper "Bonus Score Sheet" (see the `Billardscoresheet-*` folder) and verified against real numbers from 3 separate rounds:
- Round-robin pairing: across a match's 3 rounds, each of a team's 3 lineup players faces each of the opponent's 3 lineup players exactly once.
- The team with the lower total handicap gets a bonus added to their score subtotal, equal to the handicap gap between the two teams, doubled and rounded to the nearest whole number. Verified exactly against 3 real rounds.
- UNCONFIRMED: the sheet has a "Bonus over 22" rule for when a team's handicap total exceeds the league's 22 cap. Sample data never triggered a nonzero value there, so it currently contributes 0 — see the `bonusOverCap()` comment in `scoring.ts`. Confirm the real rule with the league before relying on match results near that cap.

## Status
V1 built: leagues, a flat player roster (with handicaps) per league, match entry (pick 3-vs-3 from the league's player pool, with an optional team-name label per side) with auto-computed round-robin pairings and live score calculation, a full edit/delete pass on League/Player/Match per `docs/spec-editing.md` (implemented), and Postgres/Vercel deployment. Editing a match's lineup regenerates its pairings and warns before erasing any scores already entered; deleting a player is blocked while they're part of an existing match. Not yet built: season standings; persistent/named teams; a separate dev database (see Stack caveat above).

## Future ideas (not started — get the core app solid first)
- **Persistent, named Team.** Cut from the model on purpose (see Data model above) to keep setup simple — no team to create/manage before you can just add people and start a match. Bring it back only as an optional grouping layer if lineups turn out to be the same 3 people together often enough that re-picking them every match gets tedious.
- **User accounts + per-league permissions.** People log in, and roles control who can edit a given league's settings/rosters/scores vs. just view them. Real complexity here (login, sessions, password/OAuth) — hold off until there's an actual need for multiple people to independently edit the same league.
- **Weekly email reminder of the schedule.** Separate concern from accounts — just needs an email address on file per player (a lightweight field, not a login), a way to query "matches coming up this week," an email-sending service (e.g. Resend) with an API key, and a scheduled trigger. The app isn't deployed/running 24/7 anywhere yet, which is the real blocker for this — needs a hosting decision first.
