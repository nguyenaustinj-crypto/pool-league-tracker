# League rules source documents

Three real documents from "The Islands Billiard Club," provided 2026-09-02:

- `2026-1-26 Results.pdf` — a mid-season report (Week 20 of 21, Summer
  2025/Winter 2026 season): team standings, a full season schedule (already
  played), player handicaps, ERO/point leaderboards, roster/contact info,
  budget, and — critically — the league's **written rules** (near the end of the document).
- `Draft Schedule V1.1 - With Summer break.pdf` / `V1.2 - Only Holidays off.pdf`
  — two draft options for the *next* season's schedule (21 weeks, 8 teams),
  differing only in which weeks are off (a 7-week summer break vs. just
  holidays).

These are binary PDFs — this file exists so the actual rule text and
structural findings are searchable/readable without re-extracting them.

## The written rules (transcribed from the Results PDF, Rev 1.6)

1. Practice starts at 6:00, play starts at 6:30 PM. A missing player is
   placed last on the roster; if Round 1 starts before they arrive, they
   forfeit and receive their handicap (max 7 points). No makeups once the
   next round has started.
2. Official ACS 8-ball rules. 1 point per pocketed ball, 3 points for the
   8-ball. Winner gets 10 points; loser gets 1 point per ball they pocketed.
   Handicaps are set/tracked by the league director to 1 decimal place.
   The rule text describes a "base handicap" (team gap × 2) plus a separate
   "bonus over 22", with a worked example of 23.2 vs 24.7 → 5.

   **Superseded (2026-09-10):** the league stated the rule directly, and
   that's what `src/lib/scoring.ts` implements: sum each side's handicaps,
   take each side's amount over 22 (0 if at or under), double the
   difference between those two amounts, and add it rounded to the side
   with the lower over-22 amount. No bonus if neither side is over 22. This
   matches the one real filled-in sheet (23.4 vs 22.3 → +2 recorded), which
   the written-rules reading did not (it gave +3). Under the stated rule, the
   worked example's totals give 3, not 5.
3. 5-minute break allowed between rounds. Leaving mid-turn forfeits the
   game (scored as your handicap, max 7).
4. **Roster: 3–6 players per team.** No adding players after mid-season.
   **One substitution allowed, after Round 1 or Round 2.**
5. No coaching while your player is at the table (one warning, then loss of
   game) — except one captain-requested tip per game, and one captain
   timeout per round.
6. A player not at the table must sit/step away so as not to distract.
7. Disputes: no witness → shooter's call stands. Witnessed → captains vote.
   Last resort → replay the game.
8. Unsportsmanlike conduct → loss of game, scored 10-0.
9. Host may impose a 30-second shot clock for slow play.
10. Rescheduling requires coordinating a makeup match with the opposing
    team and covering their dues; otherwise forfeit rules apply (missing
    player's handicap only, capped at 7, doesn't count toward their
    points/games-played; full weekly dues still due).
11. Host provides score sheets on league night and emails them to the
    league director within 2 days.
12. **Champion = most round wins over the season.** Ties go to a scheduled
    playoff.

## Other structural findings (not yet reflected in the app)

- **Venues**: 8 numbered physical locations, each with a contact person and
  address, tied to which team is "home" that week.
- **Team captains**: name + phone per team.
- **Player status**: some players are marked "Alternates" (roster
  substitutes) vs. regular players.
- **Contact info**: phone, email, and a distinct "Starting Handicap" per
  player (implying handicaps get updated over a season from that starting
  point — the app currently only has one `rating` field, no history).
- **Season schedule**: a full 21-week schedule is planned in advance
  (team/team/date/venue per week) — separate from the per-match lineup and
  score entry the app currently handles. The app currently has no concept
  of a scheduled-but-not-yet-played match.
- **Standings**: Wins (fractional — a tie counts as 0.5, per the paper
  sheet's own footnote), Points, Games Played, and Ties, aggregated per
  team over a season. Not computed anywhere in the app yet.
- **ERO leaderboard**: a season-long per-player count of EROs (see the
  paper sheet's footnote #1). The app stores raw game scores but no ERO
  flag per game/pairing.
- **Point leaders**: season-long per-player point totals, ranked. Could be
  derived from existing `Pairing` data (sum of `homeGame1+homeGame2` etc.
  per player across all their pairings) without new fields, if season
  boundaries were tracked.
- **Budget/dues**: weekly/season pot, payouts — financial administration,
  almost certainly out of scope for this app.
