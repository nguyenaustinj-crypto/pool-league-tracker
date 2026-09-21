"use client";

import { useState, useTransition } from "react";
import { confirmScoreCard, saveScoreCard } from "@/lib/score-actions";
import {
  forfeitPoints,
  scoresToGame,
  validateGame,
  type CardScores,
  type GameEntry,
  type Side,
} from "@/lib/score-entry";
import type { CardView } from "./card-view";

// The tap pad for one table's two games, opened from a row of the score
// sheet. Nothing is typed: tap who won, then the balls the loser pocketed.

type Draft = { winner: Side | null; loserPoints: number | null; ero: boolean; forfeit: boolean };

const emptyDraft: Draft = { winner: null, loserPoints: null, ero: false, forfeit: false };

function draftsFrom(s: CardScores): [Draft, Draft] {
  const from = (game: GameEntry | null): Draft => (game ? { ...game } : emptyDraft);
  return [
    from(scoresToGame(s.homeGame1, s.awayGame1, s.homeGame1Ero, s.awayGame1Ero)),
    from(scoresToGame(s.homeGame2, s.awayGame2, s.homeGame2Ero, s.awayGame2Ero)),
  ];
}

const button = "rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50";
const primaryButton =
  "rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50";

export default function ScoreCardEditor({
  card,
  leagueId,
  matchId,
  isManager,
  onClose,
}: {
  card: CardView;
  leagueId: string;
  matchId: string;
  isManager: boolean;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<[Draft, Draft]>(() => draftsFrom(card.scores));
  const [message, setMessage] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [pending, startTransition] = useTransition();

  const nameOf = (side: Side) => (side === "home" ? card.homeName : card.awayName);
  const handicapOf = (side: Side) => (side === "home" ? card.homeHandicap : card.awayHandicap);
  const other = (side: Side): Side => (side === "home" ? "away" : "home");

  function updateDraft(index: 0 | 1, change: Partial<Draft>) {
    setDrafts((current) => {
      const next: [Draft, Draft] = [current[0], current[1]];
      const merged = { ...current[index], ...change };
      if (merged.forfeit && merged.winner) {
        merged.loserPoints = forfeitPoints(handicapOf(other(merged.winner)));
        merged.ero = false;
      }
      next[index] = merged;
      return next;
    });
  }

  function save() {
    const games: GameEntry[] = [];
    for (const draft of drafts) {
      if (!draft.winner || draft.loserPoints === null) {
        setMessage("For both games, pick who won and how many balls the loser pocketed.");
        return;
      }
      const game: GameEntry = {
        winner: draft.winner,
        loserPoints: draft.loserPoints,
        ero: draft.ero,
        forfeit: draft.forfeit,
      };
      const problem = validateGame(game, {
        loserHandicap: handicapOf(other(draft.winner)),
        isManager,
      });
      if (problem) {
        setMessage(problem);
        return;
      }
      games.push(game);
    }

    startTransition(async () => {
      const result = await saveScoreCard(leagueId, matchId, card.id, {
        version: card.version,
        games,
      });
      if (result.ok || result.stale) onClose();
      setMessage(result.ok ? null : result.message);
    });
  }

  function confirm() {
    startTransition(async () => {
      const result = await confirmScoreCard(leagueId, matchId, card.id, card.version);
      if (result.ok) onClose();
      else setMessage(result.message);
    });
  }

  return (
    <div className="flex flex-col gap-4 bg-neutral-50 p-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">
          {card.homeName} <span className="text-neutral-400">vs</span> {card.awayName}
        </div>
        <div className="text-xs text-neutral-500">
          {card.status === "EMPTY" && "Not entered yet"}
          {card.status === "ENTERED" &&
            `Entered by ${card.enteredByName ?? "a player"} · waiting for ${card.waitingOnName}`}
          {card.status === "CONFIRMED" &&
            (card.enteredByName
              ? `Entered by ${card.enteredByName}${
                  card.confirmedByName && card.confirmedByName !== card.enteredByName
                    ? `, confirmed by ${card.confirmedByName}`
                    : ""
                }`
              : "Confirmed")}
        </div>
      </div>

      {card.canConfirm && (
        <div>
          <button type="button" onClick={confirm} disabled={pending} className={primaryButton}>
            {pending ? "Confirming…" : "Confirm these scores"}
          </button>
        </div>
      )}

      {card.canEdit && (
        <>
          {([0, 1] as const).map((index) => {
            const draft = drafts[index];
            const loser = draft.winner ? other(draft.winner) : null;
            return (
              <fieldset key={index} className="flex flex-col gap-2">
                <legend className="text-sm font-semibold">Game {index + 1}</legend>

                <div className="text-sm text-neutral-600">Who won?</div>
                <div className="flex gap-2">
                  {(["home", "away"] as const).map((side) => (
                    <ChoiceButton
                      key={side}
                      selected={draft.winner === side}
                      onClick={() => updateDraft(index, { winner: side })}
                    >
                      {nameOf(side)}
                    </ChoiceButton>
                  ))}
                </div>

                {loser && !draft.forfeit && (
                  <>
                    <div className="text-sm text-neutral-600">Balls {nameOf(loser)} pocketed</div>
                    <div className="flex flex-wrap gap-1.5">
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((balls) => (
                        <ChoiceButton
                          key={balls}
                          selected={draft.loserPoints === balls}
                          onClick={() => updateDraft(index, { loserPoints: balls })}
                          compact
                        >
                          {balls}
                        </ChoiceButton>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.ero}
                        onChange={(e) => updateDraft(index, { ero: e.target.checked })}
                      />
                      ERO: {nameOf(draft.winner!)} won on their first turn, before any balls were
                      pocketed
                    </label>
                  </>
                )}

                {loser && isManager && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.forfeit}
                      onChange={(e) =>
                        // Checking it fills in the forfeit points (in
                        // updateDraft); unchecking clears them to pick again.
                        updateDraft(index, { forfeit: e.target.checked, loserPoints: null })
                      }
                    />
                    Forfeit: {nameOf(loser)} didn&apos;t play
                    {draft.forfeit &&
                      ` (gets ${forfeitPoints(handicapOf(loser))}, their handicap up to 7)`}
                  </label>
                )}
              </fieldset>
            );
          })}

          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={pending} className={primaryButton}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={onClose} disabled={pending} className={button}>
              Cancel
            </button>
          </div>
        </>
      )}

      {!card.canEdit && !card.canConfirm && (
        <p className="text-sm text-neutral-500">
          Only the two players at this table, or a league manager, can change these scores.
        </p>
      )}

      {message && (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      )}

      {card.history.length > 0 && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className="self-start text-sm text-neutral-500 underline"
          >
            {showHistory ? "Hide history" : "History"}
          </button>
          {showHistory && (
            <ul className="flex flex-col gap-1 text-xs text-neutral-600">
              {card.history.map((edit) => (
                <li key={edit.id}>
                  <span className="font-medium">{edit.who}</span>{" "}
                  {edit.note === "confirmed"
                    ? "confirmed"
                    : `changed ${edit.before} → ${edit.after}${edit.note ? ` (${edit.note})` : ""}`}{" "}
                  <span className="text-neutral-400">· {new Date(edit.when).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!card.canEdit && !card.canConfirm && card.history.length === 0 && (
        <button type="button" onClick={onClose} className={button}>
          Close
        </button>
      )}
    </div>
  );
}

function ChoiceButton({
  selected,
  onClick,
  compact,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-md border text-sm font-medium ${compact ? "h-10 w-10" : "flex-1 px-3 py-2"} ${
        selected ? "border-neutral-900 bg-neutral-900 text-white" : "bg-white hover:bg-neutral-100"
      }`}
    >
      {children}
    </button>
  );
}
