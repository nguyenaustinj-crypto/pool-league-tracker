"use client";

import { useState, useTransition } from "react";
import { confirmScoreCard, saveScoreCard } from "@/lib/score-actions";
import {
  forfeitPoints,
  scoresToGame,
  validateGame,
  type CardScores,
  type CardStatus,
  type GameEntry,
  type Side,
} from "@/lib/score-entry";

/** One table in one round, as the match page hands it to the browser. */
export interface CardView {
  id: string;
  version: number;
  status: CardStatus;
  homeName: string;
  awayName: string;
  homeHandicap: number;
  awayHandicap: number;
  isMine: boolean;
  scores: CardScores;
  enteredByName: string | null;
  confirmedByName: string | null;
  /** Who a card that's been entered is waiting on. */
  waitingOnName: string;
  canEdit: boolean;
  canConfirm: boolean;
  history: { id: string; who: string; when: string; before: string; after: string; note: string | null }[];
}

type Draft = { winner: Side | null; loserPoints: number | null; ero: boolean; forfeit: boolean };

const emptyDraft: Draft = { winner: null, loserPoints: null, ero: false, forfeit: false };

function draftFrom(game: GameEntry | null): Draft {
  return game ? { ...game } : emptyDraft;
}

function draftsFrom(s: CardScores): [Draft, Draft] {
  return [
    draftFrom(scoresToGame(s.homeGame1, s.awayGame1, s.homeGame1Ero, s.awayGame1Ero)),
    draftFrom(scoresToGame(s.homeGame2, s.awayGame2, s.homeGame2Ero, s.awayGame2Ero)),
  ];
}

const button = "rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50";
const primaryButton =
  "rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50";

export default function ScoreCard({
  card,
  leagueId,
  matchId,
  isManager,
}: {
  card: CardView;
  leagueId: string;
  matchId: string;
  isManager: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<[Draft, Draft]>(() => draftsFrom(card.scores));
  const [message, setMessage] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [pending, startTransition] = useTransition();

  const nameOf = (side: Side) => (side === "home" ? card.homeName : card.awayName);
  const handicapOf = (side: Side) => (side === "home" ? card.homeHandicap : card.awayHandicap);
  const other = (side: Side): Side => (side === "home" ? "away" : "home");

  function startEditing() {
    // Always start from what's saved now, not an old draft.
    setDrafts(draftsFrom(card.scores));
    setMessage(null);
    setEditing(true);
  }

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
      if (result.ok) {
        setEditing(false);
        setMessage(null);
      } else {
        setMessage(result.message);
        if (result.stale) setEditing(false);
      }
    });
  }

  function confirm() {
    startTransition(async () => {
      const result = await confirmScoreCard(leagueId, matchId, card.id, card.version);
      setMessage(result.ok ? null : result.message);
    });
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-3 ${card.isMine ? "border-neutral-900" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium">
          {card.homeName} <span className="text-neutral-400">vs</span> {card.awayName}
          {card.isMine && (
            <span className="ml-2 inline-block whitespace-nowrap rounded bg-neutral-900 px-1.5 py-0.5 text-xs font-medium text-white">
              Your table
            </span>
          )}
        </div>
        <StatusBadge status={card.status} />
      </div>

      <ScoreGrid card={card} />

      <p className="text-xs text-neutral-500">
        {card.status === "EMPTY" && "Not entered yet."}
        {card.status === "ENTERED" &&
          `Entered by ${card.enteredByName ?? "a player"}. Waiting for ${card.waitingOnName} to confirm.`}
        {card.status === "CONFIRMED" &&
          (card.enteredByName
            ? `Entered by ${card.enteredByName}${
                card.confirmedByName && card.confirmedByName !== card.enteredByName
                  ? `, confirmed by ${card.confirmedByName}`
                  : ""
              }.`
            : "Confirmed.")}
      </p>

      {!editing && (card.canEdit || card.canConfirm || card.history.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {card.canConfirm && (
            <button type="button" onClick={confirm} disabled={pending} className={primaryButton}>
              {pending ? "Confirming…" : "Confirm"}
            </button>
          )}
          {card.canEdit && (
            <button type="button" onClick={startEditing} disabled={pending} className={button}>
              {card.status === "EMPTY" ? "Enter score" : card.canConfirm ? "Fix it" : "Edit"}
            </button>
          )}
          {card.history.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((s) => !s)}
              className="text-sm text-neutral-500 underline"
            >
              {showHistory ? "Hide history" : "History"}
            </button>
          )}
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-4 border-t pt-3">
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
                      onClick={() => updateDraft(index, { winner: side, loserPoints: draft.forfeit ? null : draft.loserPoints })}
                    >
                      {nameOf(side)}
                    </ChoiceButton>
                  ))}
                </div>

                {loser && !draft.forfeit && (
                  <>
                    <div className="text-sm text-neutral-600">
                      Balls {nameOf(loser)} pocketed
                    </div>
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
                    {draft.forfeit && ` (gets ${forfeitPoints(handicapOf(loser))}, their handicap up to 7)`}
                  </label>
                )}
              </fieldset>
            );
          })}

          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={pending} className={primaryButton}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setMessage(null);
              }}
              disabled={pending}
              className={button}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      )}

      {showHistory && !editing && (
        <ul className="flex flex-col gap-1 border-t pt-2 text-xs text-neutral-600">
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
  );
}

function ScoreGrid({ card }: { card: CardView }) {
  const s = card.scores;
  const played = (h: number, a: number) => h !== 0 || a !== 0;
  const cell = (value: number, won: boolean, ero: boolean, isPlayed: boolean) => (
    <span
      className={`inline-flex min-w-7 justify-center tabular-nums ${won ? "font-semibold" : "text-neutral-600"} ${
        ero ? "rounded-full ring-1 ring-neutral-900" : ""
      }`}
      title={ero ? "ERO" : undefined}
    >
      {isPlayed ? value : "–"}
    </span>
  );
  const g1 = played(s.homeGame1, s.awayGame1);
  const g2 = played(s.homeGame2, s.awayGame2);
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-1 text-sm">
      <span />
      <span className="text-xs text-neutral-400">G1</span>
      <span className="text-xs text-neutral-400">G2</span>
      <span className="truncate">{card.homeName}</span>
      {cell(s.homeGame1, s.homeGame1 > s.awayGame1, s.homeGame1Ero, g1)}
      {cell(s.homeGame2, s.homeGame2 > s.awayGame2, s.homeGame2Ero, g2)}
      <span className="truncate">{card.awayName}</span>
      {cell(s.awayGame1, s.awayGame1 > s.homeGame1, s.awayGame1Ero, g1)}
      {cell(s.awayGame2, s.awayGame2 > s.homeGame2, s.awayGame2Ero, g2)}
    </div>
  );
}

function StatusBadge({ status }: { status: CardStatus }) {
  const styles: Record<CardStatus, [string, string]> = {
    EMPTY: ["Not entered", "bg-neutral-100 text-neutral-600"],
    ENTERED: ["Needs confirming", "bg-amber-100 text-amber-800"],
    CONFIRMED: ["Confirmed", "bg-green-100 text-green-800"],
  };
  const [label, className] = styles[status];
  return <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
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
        selected ? "border-neutral-900 bg-neutral-900 text-white" : "hover:bg-neutral-50"
      }`}
    >
      {children}
    </button>
  );
}
