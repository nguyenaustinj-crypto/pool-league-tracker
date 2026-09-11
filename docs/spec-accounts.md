# Spec: Accounts, roles, and player score entry

Status: **proposed, not started.** Decisions still open are listed at the
bottom.

The shared editor passcode (see `CLAUDE.md`) is a stopgap: everyone who has
it is the same anonymous "editor", so there's no way to show "my leagues",
give a league its own manager, or let players enter their own scores. This
spec replaces it with real sign-in, while still storing **no passwords**.

The flow we want: open the app and you're already signed in, landing on
**My leagues**. Players tap into their league, find their table, and enter
their scores. Managers run their own league. Admins can step in anywhere.

## Sign-in

- **No passwords.** Two ways in: **Sign in with Google**, or an **emailed
  sign-in link**. The link covers players who don't use Gmail.
- **Stay signed in.** Using the app should keep you signed in, so opening it
  doesn't mean signing in again. This requirement decides which sign-in
  service we can use (see below).
- **Feels like an app.** Add a web app manifest and icons so "Add to Home
  Screen" opens it full-screen with its own icon.

### Which sign-in service

Checked 2026-09-11 against what's installed (Next 16.3.3, React 19.2.8,
Prisma 7) and each service's own pricing and docs:

| | Better Auth (`better-auth` 1.7.4) | Clerk (`@clerk/nextjs` 7.9.2) |
|---|---|---|
| Supports our Next/React | Yes (next `^16`, prisma `^7`) | Yes (next `^16.1`, react `~19.2.3`) |
| Cost | Free (open source) | Free up to 50,000 monthly retained users. Pro is $25/mo, or $20/mo billed annually. |
| Staying signed in | Session lasts 7 days and is extended each day you use the app, so regular players stay signed in. Configurable. | **Free plan: signed out after 7 days even if you use the app daily** (maximum session lifetime, only changeable on paid plans). Pro allows a longer session. |
| Where user data lives | Our Postgres: email and name only, since there are no passwords. | Clerk's servers. We keep only a Clerk user id and display name. |
| Google + email link | Built in. We build the sign-in screens, and email links need an email-sending service (e.g. Resend; check its free-tier limits). | Built in, including the sign-in screens (Clerk branding stays on the free plan). |
| Lock-in | None | Moving off later means migrating users |

**Decision (2026-09-11): Better Auth, keeping everything free for now.**
Clerk's free plan signs everyone out every week, and Pro costs $25/mo.

- **Where accounts live:** the Prisma Postgres database we already run on
  Vercel. No new paid service. Accounts are a few small rows per person,
  well within the free plan (200k operations/month, 500 MB storage, checked
  2026-09-11).
- **Start with Google sign-in only.** It's free and needs no email service.
- **Add emailed sign-in links when players need them,** using Resend's free
  plan (3,000 emails/month, 100/day), which is plenty for sign-in links.
- **No lock-in:** user data is in our own database, so moving to a paid
  service later (e.g. Clerk Pro, if we'd rather keep user data off our
  database) is a migration, not a rebuild.

Auth.js / NextAuth v5 is left out: it's still in beta (`5.0.0-beta.32`).

## Roles

Two layers:

- **Admin** covers the whole app. It's a flag on the user, granted
  outside the app (an `ADMIN_EMAILS` env var or set directly in the
  database), never through a button, so nobody can promote themselves.
  Austin and Jamey.
- **League role** exists per league: **manager** or **player**. A person can
  manage one league and play in another.

Separately, an account can be **linked to a roster name** (a `Player` on a
team). That link is what makes a manager "also a player", and it's how the
app knows which tables are yours.

| Action | Admin | League manager | Player |
|---|---|---|---|
| Search leagues, request to join | Yes | Yes | Yes |
| View standings, matches, scores | All leagues | Their leagues | Their leagues |
| Create a league | Yes | Yes | Yes (creating one makes you its manager) |
| Teams, rosters, handicaps, create/edit matches | Any league | Their league | No |
| Enter scores | Any match | Any match in their league | Tables they're playing, until the match is locked |
| Approve join requests, send invites, add co-managers | Any league | Their league | No |
| Lock / unlock a match | Any league | Their league | No |
| Delete a league | Yes | No (too destructive) | No |

## Screens

```
/                             signed out: what the app is + Sign in
/                             signed in: My leagues + Create league (admins see all leagues)
/leagues/search               find a league by name, request to join
/invite/[token]               sign in if needed, then join the league (and link to a roster name)
/leagues/[leagueId]/…         members only; non-members see the league name and "Request to join"
/leagues/[leagueId]/members   managers: pending join requests, invites, members and roles
```

On a match page, a signed-in player sees **their own tables first**.

## Joining a league

League pages are **members only**. There are two ways in, and **a manager
always decides** who gets in and which roster name they are.

### 1. Search and request to join

- Any signed-in user can search leagues by name.
- Search results show **only the league name**. Rosters, scores, and member
  names stay private until you're in.
- Tap **Request to join**. The league's managers see it on their members
  page, with a badge so pending requests don't get missed.
- The manager **approves** or **declines**. When approving, they pick **which
  roster name this person is**, or add them as a new name on a team. That
  keeps the protection against claiming the wrong name.
- One pending request per person per league. Someone who was declined can
  ask again later.

### 2. Invite link

The faster path when the manager already has the player's number:

- Each roster name has an **Invite** button, which makes a one-time link.
  The manager texts it to that player.
- Opening it: sign in (or sign up), then the account is linked to that
  roster name and joins the league as a player. No approval step, because
  the manager created the link for that specific name.
- **Manager invites** (for co-managers) are separate links that grant the
  manager role. Linking to a roster name is optional for those.
- **Link rules:** random token, stored hashed, single use, expires after 14
  days. The manager can revoke a link or unlink an account from a name.

### Either way

- **Players without an account** (or without a phone) stay on the roster
  like today, and the manager enters their scores.
- One account links to at most one roster name per league. The same
  account can be on rosters in different leagues.

## Score entry on league night

Each table in each round is a **score card**: one home player against one
away player, two games.

### Scoring facts this relies on

Per the league rules, confirmed against the real paper sheet: each player
has 7 balls worth 1 point each, and the 8-ball is worth 3. Sinking the
8-ball wins, so **the winner always gets exactly 10**. Pocketing the 8 early
loses, so **the loser gets 0–7**. Scores of 8 or 9 can't happen. Every game on
the real sheet has one side at 10 and the other at 7 or less.

**ERO**, from the paper sheet's footnote #1: a game won on the winner's
**first turn at the table, before any balls have been pocketed**. The sheet
marks it by circling the winner's score. It **doesn't change the score**
(still 10). It's counted per player for the league's ERO leaderboard.

### Protections against wrong entries

1. **Tap instead of type.** For each game: tap **who won** (they get 10), then
   tap the **loser's ball count** from buttons 0–7. Impossible scores (8, 9,
   anything over 10, both sides at 10) can't be entered. The winner's side
   also has an **ERO** toggle.
2. **Manager-only exceptions.** A forfeit is scored as the missing player's
   handicap, capped at 7, and can be a decimal (e.g. 6.9). Only a manager
   can enter it, with a note. `Pairing` scores are already stored as `Float`,
   so no type change is needed. Unsportsmanlike conduct is 10–0, which the
   normal tap entry already covers.
3. **Either player can fill in the card; the other confirms.** A card moves from
   *empty* to *entered by Austin* to *confirmed by Ethan*. If the second
   player changes it instead of confirming, it becomes *entered by Ethan*,
   and Austin is asked to confirm. Scores **count in standings right away**
   so nothing stalls waiting on someone. Unconfirmed cards get a badge, and
   the manager sees a list of them.
4. **Every change is recorded:** who, when, and what the card said before. A
   manager can see the history and undo a change.
5. **The manager locks the match** when it's done (the rules give hosts 2
   days to turn in sheets). After that, only managers and admins can change
   its scores. Auto-locking can come later.

### Saving (fixes a real bug in today's score sheet)

Today's **Save Scores** sends the *whole match* as it looked when that phone
loaded the page. If two tables save around the same time, the second save
overwrites the first table's scores with its stale copy. That's rare with
one editor, but guaranteed on league night once players enter their own
cards. The new version:

- **saves one card at a time**, and
- sends the card's **version number** with each save. If someone else saved
  that card in the meantime, the player sees "Ethan just updated this card"
  with the new numbers, instead of overwriting them.

## Data model changes (sketch)

All additive: new tables, plus nullable or defaulted columns on existing
ones. Existing leagues, rosters, and scores carry over untouched.

```prisma
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String
  isAdmin     Boolean  @default(false)
  createdAt   DateTime @default(now())
  memberships LeagueMembership[]
  players     Player[]                // roster names linked to this account
}

enum LeagueRole { MANAGER PLAYER }

model LeagueMembership {
  user     User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId   String
  league   League     @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  leagueId String
  role     LeagueRole
  @@id([userId, leagueId])
}

enum JoinRequestStatus { PENDING APPROVED DECLINED }

model JoinRequest {
  id          String            @id @default(cuid())
  leagueId    String
  userId      String
  status      JoinRequestStatus @default(PENDING)
  createdAt   DateTime          @default(now())
  decidedById String?
  decidedAt   DateTime?
}

model Invite {
  id          String     @id @default(cuid())
  tokenHash   String     @unique
  leagueId    String
  role        LeagueRole
  playerId    String?    // roster name this invite links to, if any
  createdById String
  expiresAt   DateTime
  usedAt      DateTime?
  usedById    String?
}

// League:  listed Boolean @default(true)   (shows up in search; see open decisions)
// Player:  userId String?   (roster name linked to an account)
// Match:   lockedAt DateTime?, lockedById String?
// Pairing: status (EMPTY | ENTERED | CONFIRMED), enteredById String?,
//          confirmedById String?, version Int @default(0),
//          homeGame1Ero / homeGame2Ero / awayGame1Ero / awayGame2Ero Boolean @default(false)

model ScoreEdit {
  id        String   @id @default(cuid())
  pairingId String
  userId    String
  before    Json
  after     Json
  note      String?  // e.g. "forfeit"
  createdAt DateTime @default(now())
}
```

Better Auth adds its own session/account/verification tables alongside
`User`. With Clerk, `User.id` would be the Clerk user id instead, and no
session tables.

## Server-side checks

`requireEditor()` gets replaced by checks that know *who* and *which league*:

- `requireUser()`: signed in at all.
- `requireLeagueRole(leagueId, "MANAGER")`: admins always pass.
- `requireCanScore(pairingId)`: admin, a manager of that league, or one of
  the two linked players on that card, and the match isn't locked (unless
  the caller is a manager).
- **Reads need checks too, not just writes,** since league pages are
  members-only. Search returns league names only.
- **Every id from the browser must be checked against its league.** Today's
  actions trust that, e.g., `updateTeam(leagueId, teamId)` got a `teamId` that
  actually belongs to `leagueId`. That's harmless with one editor, but with
  per-league managers it would let a manager of league A edit league B's teams
  by passing B's ids. Each action must load the record and confirm its league
  before changing it.

The rule from the passcode work still applies: **every server action
checks on the server first**, because actions accept direct POST requests.

## Rollout (each stage ships on its own)

0. **Separate dev database first.** *Done 2026-09-11:* local `.env` points at
   a free `pool-league-dev` database, seeded with `npx prisma db seed`.
1. **Sign-in + admins.** Add Google sign-in (via Better Auth) and the `User`
   table. Admins get
   today's editor powers, and the passcode is removed once admin sign-in is
   verified live. Leagues stay publicly viewable during this stage.
2. **Leagues and roles.** Memberships, "Create league makes you manager", the
   My leagues home, the league-ownership checks above, and members-only
   league pages. Jamey becomes manager of the existing league.
3. **Joining.** League search, join requests with manager approval, invite
   links, and linking accounts to roster names.
4. **Player score entry.** Tap-to-score cards with the ERO toggle, one-card
   saves with version checks, confirmation, edit history, match locking.
5. **Polish.** Home-screen install, "my matches" / "my stats" for players,
   and the ERO and points leaderboards.

## Open decisions

1. **Hiding from search:** can a manager make their league unlisted
   (invite-only)? Assumed: listed by default, with an option to hide.
2. **Unconfirmed scores count right away:** assumed yes. The alternative is
   waiting for confirmation or manager approval, which can stall standings.
3. **Invite links expire after 14 days:** assumed. Is that OK?
