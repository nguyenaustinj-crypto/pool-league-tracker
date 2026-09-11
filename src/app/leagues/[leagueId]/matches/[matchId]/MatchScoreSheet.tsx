"use client";

import { useMemo, useState, useTransition } from "react";
import { saveMatchScores, type PairingScoreUpdate } from "@/lib/actions";
import { amountOverCap, calculateRoundScore, HANDICAP_CAP, type PairingScore } from "@/lib/scoring";

interface PlayerInfo {
  id: string;
  name: string;
  rating: number;
}

interface PairingData extends PairingScore {
  id: string;
  homePlayer: PlayerInfo;
  awayPlayer: PlayerInfo;
}

interface RoundData {
  id: string;
  roundNumber: number;
  pairings: PairingData[];
}

const emptyScores = { homeGame1: 0, homeGame2: 0, awayGame1: 0, awayGame2: 0 };

export default function MatchScoreSheet({
  leagueId,
  matchId,
  homeTeamName,
  awayTeamName,
  rounds,
  canEdit,
}: {
  leagueId: string;
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  rounds: RoundData[];
  /** Viewers see the same sheet, with scores as plain numbers and no save button. */
  canEdit: boolean;
}) {
  const [scores, setScores] = useState<Record<string, PairingScore>>(() => {
    const initial: Record<string, PairingScore> = {};
    for (const round of rounds) {
      for (const pairing of round.pairings) {
        initial[pairing.id] = {
          homeGame1: pairing.homeGame1,
          homeGame2: pairing.homeGame2,
          awayGame1: pairing.awayGame1,
          awayGame2: pairing.awayGame2,
        };
      }
    }
    return initial;
  });
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function updateScore(pairingId: string, field: keyof PairingScore, value: string) {
    const numeric = value === "" ? 0 : Number(value);
    setScores((prev) => ({
      ...prev,
      [pairingId]: { ...(prev[pairingId] ?? emptyScores), [field]: numeric },
    }));
    setSaved(false);
  }

  const roundScores = useMemo(
    () =>
      rounds.map((round) => {
        const homeHandicapTotal = round.pairings.reduce((sum, p) => sum + p.homePlayer.rating, 0);
        const awayHandicapTotal = round.pairings.reduce((sum, p) => sum + p.awayPlayer.rating, 0);
        const pairingScores = round.pairings.map((p) => scores[p.id] ?? emptyScores);
        return calculateRoundScore(pairingScores, homeHandicapTotal, awayHandicapTotal);
      }),
    [rounds, scores]
  );

  const matchHomeTotal = roundScores.reduce((sum, r) => sum + r.home.roundTotal, 0);
  const matchAwayTotal = roundScores.reduce((sum, r) => sum + r.away.roundTotal, 0);

  function handleSave() {
    const updates: PairingScoreUpdate[] = rounds.flatMap((round) =>
      round.pairings.map((p) => ({ pairingId: p.id, ...(scores[p.id] ?? emptyScores) }))
    );
    startTransition(async () => {
      await saveMatchScores(leagueId, matchId, updates);
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between rounded-lg border bg-neutral-50 p-4">
        <div className="font-medium">
          {homeTeamName} vs {awayTeamName}
        </div>
        <div className="text-2xl font-bold tabular-nums">
          {matchHomeTotal} – {matchAwayTotal}
        </div>
      </div>

      {rounds.map((round, i) => {
        const score = roundScores[i];

        return (
          <div key={round.id} className="flex flex-col gap-3 rounded-lg border p-4">
            <h2 className="font-semibold">Round {round.roundNumber}</h2>

            <div className="flex flex-col gap-2">
              {round.pairings.map((pairing) => {
                const s = scores[pairing.id] ?? emptyScores;
                return (
                  <div key={pairing.id} className="grid grid-cols-2 items-center gap-2 text-sm">
                    <div className="col-span-2 font-medium">
                      {pairing.homePlayer.name} <span className="text-neutral-400">vs</span>{" "}
                      {pairing.awayPlayer.name}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-20 text-neutral-500">{pairing.homePlayer.name}</span>
                      <ScoreInput
                        value={s.homeGame1}
                        readOnly={!canEdit}
                        onChange={(v) => updateScore(pairing.id, "homeGame1", v)}
                      />
                      <ScoreInput
                        value={s.homeGame2}
                        readOnly={!canEdit}
                        onChange={(v) => updateScore(pairing.id, "homeGame2", v)}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-20 text-neutral-500">{pairing.awayPlayer.name}</span>
                      <ScoreInput
                        value={s.awayGame1}
                        readOnly={!canEdit}
                        onChange={(v) => updateScore(pairing.id, "awayGame1", v)}
                      />
                      <ScoreInput
                        value={s.awayGame2}
                        readOnly={!canEdit}
                        onChange={(v) => updateScore(pairing.id, "awayGame2", v)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-3 text-sm">
              <RoundSummary label={homeTeamName} team={score.home} />
              <RoundSummary label={awayTeamName} team={score.away} />
            </div>
          </div>
        );
      })}

      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-md bg-neutral-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save Scores"}
          </button>
          {saved && <span className="text-sm text-green-600">Saved.</span>}
        </div>
      )}
    </div>
  );
}

function ScoreInput({
  value,
  readOnly,
  onChange,
}: {
  value: number;
  readOnly: boolean;
  onChange: (v: string) => void;
}) {
  if (readOnly) {
    return <span className="w-14 px-2 py-1 text-center tabular-nums">{value}</span>;
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      value={value === 0 ? "" : value}
      placeholder="0"
      onChange={(e) => onChange(e.target.value)}
      className="w-14 rounded-md border px-2 py-1 text-center"
    />
  );
}

function RoundSummary({
  label,
  team,
}: {
  label: string;
  team: ReturnType<typeof calculateRoundScore>["home"];
}) {
  const overCap = amountOverCap(team.handicapTotal);

  return (
    <div>
      <div className="font-medium">{label}</div>
      <div className="text-neutral-500">Score subtotal: {team.scoreSubtotal}</div>
      <div className="text-neutral-500">
        {/* Summed handicaps are floats; one decimal matches how handicaps are kept. */}
        Handicap total: {team.handicapTotal.toFixed(1)}
        {overCap > 0 && (
          <span className="text-neutral-400">
            {" "}
            ({overCap.toFixed(1)} over {HANDICAP_CAP})
          </span>
        )}
      </div>
      <div className="text-neutral-500">Bonus: {team.bonus}</div>
      <div className="font-semibold">Round total: {team.roundTotal}</div>
    </div>
  );
}
