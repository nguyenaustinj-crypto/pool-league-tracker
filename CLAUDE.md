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

**Temporary: repo is public.** Vercel's Hobby plan refuses to build a commit pushed by a GitHub account that isn't a team member on a *private* repo (a second family member, Jamey, pushes directly to `master` too). Made public (2026-09-02) as the free/immediate fix rather than upgrading to Pro; found reverted back to private on 2026-09-09 (cause unknown — check this if deploys start getting blocked with "Hobby Plan does not support collaboration for private repositories" again) and re-confirmed public with `gh repo edit ... --visibility public`. Revisit once the app has real users/data: either upgrade to Vercel Pro and add him as a real team member (keeps the repo private), or accept staying public long-term — the code has no secrets in it (DB credentials live only in Vercel env vars and local `.env`, never committed), so public-ness is a visibility tradeoff, not a security one.

**Caveat on the shared database:** local dev and the deployed app currently point at the *same* Prisma Postgres database (via the same `DATABASE_URL`). There's no separate dev database yet. Any local testing that writes data should clean up after itself (delete what you created) so it doesn't show up for real users of the deployed app.

## Data model (`prisma/schema.prisma`)
League → Team (persistent, named) → Player (every Player belongs to exactly one Team — no team-less players), and Match (belongs to a League, and references a `homeTeam`/`awayTeam` Team) → Round (xN) → Pairing (one home player vs one away player, 2 games/racks each). A match's two sides are two of the league's Teams, picked at match-creation time via a "which two teams, how many tables?" step — N players per side (N = table count, chosen per match, capped by the smaller team's roster size), validated server-side so each picked player actually belongs to the matching side's Team. Table *i*'s home/away picks directly become Round 1's pairing *i*; `awayIndexForRound` in `scoring.ts` generalizes the round-robin rotation to any N (originally hardcoded to 3, matching the paper sheet's fixed 3-a-side format).

Cascade note: `Pairing.homePlayer`/`awayPlayer`, `Player.team`, and `Match.homeTeam`/`awayTeam` all cascade-delete, so deleting a League (which cascades to its Teams, which cascade to their Players) doesn't hit a foreign-key violation from Pairings/Matches still referencing them. The actual protection against deleting a Player who's mid-match, or a Team that's played a Match, is the app-level checks in `deletePlayer`/`deleteTeam` (`src/lib/actions.ts`), not these schema-level cascades — those only matter once the whole League is being torn down.

**History:** Team existed originally, was deliberately removed in favor of a flat League→Player pool with free-text `homeLabel`/`awayLabel` per match (see `git log --oneline -- prisma/schema.prisma` around "Drop persistent Team, put Players directly in a League"), then reintroduced (this version) once real use showed the flat pool let you pick any player for either side, with no actual team scoping — the free-text labels didn't constrain the roster the way real leagues need. `Team` is now required, not optional: every Player belongs to one, and a Match's `homeTeam`/`awayTeam` are real Team relations, not text.

Routes are nested under `/leagues/[leagueId]/...` (and `/leagues/[leagueId]/teams/[teamId]/...` for a team's own roster) so teams, players, and matches are always viewed/created in the context of one league.

## Scoring rules (`src/lib/scoring.ts`)
Reverse-engineered from real filled-in copies of the paper "Bonus Score Sheet" (see the `Billardscoresheet-*` folder) and verified against real numbers from 3 separate rounds:
- Round-robin pairing: across a match's N rounds (N = table count), each of a team's N lineup players faces each of the opponent's N lineup players exactly once. Verified against the real sheet's N=3 case; generalized to arbitrary N and re-verified with a live N=2 match.
- The team with the lower total handicap gets a bonus added to their score subtotal, equal to the handicap gap between the two teams, doubled and rounded to the nearest whole number. Verified exactly against 3 real rounds.
- CONFIRMED (2026-09-02, see `docs/league-rules/README.md`): the "Bonus over 22" rule from the league's actual written rules is now implemented in `bonusOverCap()`. It matches the rule's own worked example exactly, but applying it to the one real match sheet this app was originally verified against produces a different bonus (3) than what that sheet recorded (2) — see the caveat in `scoring.ts`. Worth confirming with the league whether this is applied consistently in real play.

## League rules & source documents (`docs/league-rules/`)
Real documents from "The Islands Billiard Club" (provided 2026-09-02): the full written league rules (roster size 3-6, one substitution per match, forfeit/dispute/coaching rules, champion = most round wins), a season's results/standings/leaderboards, and two draft schedules for the next season. See `docs/league-rules/README.md` for the transcribed rules and a list of structural gaps between what's in these documents and what the app currently models (venues, team captains, alternates vs. regular players, a pre-planned season schedule, ERO/point leaderboards) — not built yet, beyond the handicap-bonus formula and standings below.

## Standings (`src/lib/standings.ts`)
Per rule #12, the league's champion is whoever has the most **round wins** across the season, not match wins -- so standings tally every round of every match independently (a match with N tables has N independent round outcomes), with a tied round counting as half a win and half a loss for both teams (footnote #2). Points = the sum of each round's total (score subtotal + handicap bonus) across the season. Computed live from a league's Matches on the league page -- there's no separate "season" entity yet, so this is all-time across everything a League has ever recorded, not scoped to a season boundary.

## Status
V1 built: leagues, persistent named Teams per league with a player roster (with handicaps) each, match entry that picks two teams and a variable table count (one player per side per table, drawn from the matching team's roster) with auto-computed round-robin pairings and live score calculation, live standings per league, a full edit/delete pass on League/Team/Player/Match per `docs/spec-editing.md`, and Postgres/Vercel deployment (live). Editing a match's teams/table count/lineup regenerates its pairings and warns before erasing any scores already entered; deleting a player is blocked while they're part of an existing match, and deleting a team is blocked while it's played in an existing match. Not yet built: a season boundary/reset for standings; a separate dev database (see Stack caveat above).

**Schema migration status:** the Team model above was reintroduced (2026-09-02) via migration `20260903012920_add_teams`, applied directly against the live Prisma Postgres database. At the time, the database held only test/scratch data (6 leagues, 21 players, 2 matches, none of it real league history), which was deliberately wiped before migrating so `Player.teamId`/`Match.homeTeamId`/`awayTeamId` could be added as plain required columns — no backfill logic needed. The live database is empty as of this migration; next real usage starts fresh.

## Future ideas (not started — get the core app solid first)
- **User accounts + per-league permissions.** People log in, and roles control who can edit a given league's settings/rosters/scores vs. just view them. Real complexity here (login, sessions, password/OAuth) — hold off until there's an actual need for multiple people to independently edit the same league.
- **Weekly email reminder of the schedule.** Separate concern from accounts — just needs an email address on file per player (a lightweight field, not a login), a way to query "matches coming up this week," an email-sending service (e.g. Resend) with an API key, and a scheduled trigger. The app isn't deployed/running 24/7 anywhere yet, which is the real blocker for this — needs a hosting decision first.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
