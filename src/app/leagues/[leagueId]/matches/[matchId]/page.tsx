import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLeagueView } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { setMatchLock } from "@/lib/score-actions";
import {
  canConfirmCard,
  canEditCard,
  cardScoresOf,
  formatCardScores,
  type CardScores,
} from "@/lib/score-entry";
import type { CardView } from "./card-view";
import MatchHandicaps from "./MatchHandicaps";
import MatchScoreSheet from "./MatchScoreSheet";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ leagueId: string; matchId: string }>;
}) {
  const { leagueId, matchId } = await params;
  const access = await requireLeagueView(leagueId, `/leagues/${leagueId}/matches/${matchId}`);
  const isManager = access.canManage;
  const viewerUserId = access.user?.id ?? null;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      league: true,
      homeTeam: true,
      awayTeam: true,
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: {
          pairings: {
            orderBy: { tableNumber: "asc" },
            include: {
              homePlayer: true,
              awayPlayer: true,
              edits: { orderBy: { createdAt: "desc" }, take: 20 },
            },
          },
        },
      },
    },
  });

  if (!match || match.leagueId !== leagueId) notFound();

  // Names for everyone who entered, confirmed, or changed a card.
  const pairings = match.rounds.flatMap((r) => r.pairings);
  const userIds = new Set<string>();
  for (const p of pairings) {
    for (const id of [p.enteredById, p.confirmedById, ...p.edits.map((e) => e.userId)]) {
      if (id) userIds.add(id);
    }
  }
  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, name: true },
  });
  const userName = new Map(users.map((u) => [u.id, u.name]));
  // A null id is a site admin using the editor passcode, who has no account.
  const nameOf = (id: string | null) => (id ? (userName.get(id) ?? "A former member") : "A site admin");

  const locked = match.lockedAt !== null;
  const unconfirmed = pairings.filter((p) => p.status === "ENTERED").length;
  const anyScores = pairings.some((p) => p.status !== "EMPTY");

  // Round 1 is the lineup: table i is home[i] against away[i].
  const firstRound = match.rounds[0];
  const homeLineup =
    firstRound?.pairings.map((p) => ({
      id: p.homePlayerId,
      name: p.homePlayer.name,
      handicap: p.homeHandicap,
    })) ?? [];
  const awayLineup =
    firstRound?.pairings.map((p) => ({
      id: p.awayPlayerId,
      name: p.awayPlayer.name,
      handicap: p.awayHandicap,
    })) ?? [];

  const rounds = match.rounds.map((round) => ({
    id: round.id,
    roundNumber: round.roundNumber,
    cards: round.pairings.map((p): CardView => {
      const homeUserId = p.homePlayer.userId;
      const awayUserId = p.awayPlayer.userId;
      // Who an entered card is waiting on: the other player, if they have an
      // account; otherwise only a manager can confirm it.
      const otherSide = p.enteredById === homeUserId ? p.awayPlayer : p.homePlayer;
      return {
        id: p.id,
        tableNumber: p.tableNumber,
        version: p.version,
        status: p.status,
        homeName: p.homePlayer.name,
        awayName: p.awayPlayer.name,
        homeHandicap: p.homeHandicap,
        awayHandicap: p.awayHandicap,
        isMine: viewerUserId !== null && (viewerUserId === homeUserId || viewerUserId === awayUserId),
        scores: cardScoresOf(p),
        enteredByName: p.enteredById ? nameOf(p.enteredById) : null,
        confirmedByName: p.confirmedById ? nameOf(p.confirmedById) : null,
        waitingOnName: otherSide.userId ? otherSide.name : "a league manager",
        canEdit: canEditCard({ isManager, viewerUserId, homeUserId, awayUserId, locked }),
        canConfirm: canConfirmCard({
          isManager,
          viewerUserId,
          homeUserId,
          awayUserId,
          locked,
          status: p.status,
          enteredById: p.enteredById,
        }),
        history: p.edits.map((e) => ({
          id: e.id,
          who: nameOf(e.userId),
          when: e.createdAt.toISOString(),
          before: formatCardScores(e.before as CardScores),
          after: formatCardScores(e.after as CardScores),
          note: e.note,
        })),
      };
    }),
  }));

  const homeTeamName = match.homeTeam.name;
  const awayTeamName = match.awayTeam.name;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500">
        <Link href="/" className="underline">
          My leagues
        </Link>{" "}
        /{" "}
        <Link href={`/leagues/${leagueId}/matches`} className="underline">
          {match.league.name}
        </Link>
      </p>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {homeTeamName} vs {awayTeamName}
        </h1>
        {isManager && (
          <Link
            href={`/leagues/${leagueId}/matches/${matchId}/edit`}
            className="text-sm text-neutral-500 underline"
          >
            Edit
          </Link>
        )}
      </div>
      <p className="text-sm text-neutral-500">{new Date(match.date).toLocaleDateString()}</p>

      {(locked || isManager) && (
        <div className="flex flex-col gap-2 rounded-lg border bg-neutral-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-neutral-700">
            {locked
              ? "This match is locked. Only league managers can change its scores."
              : unconfirmed > 0
                ? `${unconfirmed} table${unconfirmed === 1 ? "" : "s"} still need${unconfirmed === 1 ? "s" : ""} confirming.`
                : "Lock the match once the scores are final."}
          </span>
          {isManager && (
            <form action={setMatchLock.bind(null, leagueId, matchId, !locked)}>
              <button
                type="submit"
                className="rounded-md border bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
              >
                {locked ? "Unlock" : "Lock match"}
              </button>
            </form>
          )}
        </div>
      )}

      {isManager && !locked && (
        <MatchHandicaps
          leagueId={leagueId}
          matchId={matchId}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
          home={homeLineup}
          away={awayLineup}
          anyScores={anyScores}
        />
      )}

      <MatchScoreSheet
        leagueId={leagueId}
        matchId={match.id}
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        rounds={rounds}
        isManager={isManager}
      />
    </div>
  );
}
