"use client";

import { useState } from "react";
import type { CardScores } from "@/lib/score-entry";
import type { CardView } from "./card-view";
import ScoreCardEditor from "./ScoreCardEditor";

// One round, laid out like the league's paper "Bonus Score Sheet": each
// side's players with their handicap, both games and a total, then the
// round's summary block. Tapping a row opens the tap pad for that table.

export interface RoundSummary {
  played: boolean;
  homeSubtotal: number;
  awaySubtotal: number;
  homeHandicapTotal: number;
  awayHandicapTotal: number;
  homeOver: number;
  awayOver: number;
  difference: number;
  doubled: number;
  rounded: number;
  homeBonus: number;
  awayBonus: number;
  homeTotal: number;
  awayTotal: number;
}

const cell = "border border-neutral-300 px-1.5 py-1";
const head = `${cell} bg-neutral-100 text-[11px] font-medium leading-tight text-neutral-600`;
const number = `${cell} text-right text-xs tabular-nums`;

export default function RoundSheet({
  leagueId,
  matchId,
  isManager,
  homeTeamName,
  awayTeamName,
  roundNumber,
  cards,
  summary,
}: {
  leagueId: string;
  matchId: string;
  isManager: boolean;
  homeTeamName: string;
  awayTeamName: string;
  roundNumber: number;
  cards: CardView[];
  summary: RoundSummary;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const outcome = (mine: number, theirs: number) =>
    !summary.played ? null : mine === theirs ? "TIE" : mine > theirs ? "WIN" : "LOSS";
  const homeOutcome = outcome(summary.homeTotal, summary.awayTotal);
  const awayOutcome = outcome(summary.awayTotal, summary.homeTotal);

  const editingCard = cards.find((c) => c.id === editingId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[660px] border-collapse text-sm">
        <thead>
          <tr>
            <th colSpan={7} className={`${cell} bg-neutral-50 text-left`}>
              <span className="text-xs font-normal text-neutral-500">(Home) </span>
              {homeTeamName}
            </th>
            <th colSpan={7} className={`${cell} bg-neutral-50 text-left`}>
              {awayTeamName}
            </th>
          </tr>
          <tr>
            <td colSpan={5} className={`${cell} font-semibold`}>
              Round {roundNumber}:
            </td>
            <td colSpan={2} className={`${cell} text-right`}>
              <Outcome outcome={homeOutcome} />
            </td>
            <td colSpan={5} className={cell} />
            <td colSpan={2} className={`${cell} text-right`}>
              <Outcome outcome={awayOutcome} />
            </td>
          </tr>
          <tr>
            {[0, 1].map((side) => (
              <Fragmentish key={side}>
                <th className={`${head} w-6`}>#</th>
                <th className={`${head} text-left`}>Names</th>
                <th className={`${head} w-12`} />
                <th className={`${head} w-16`}>Handicap</th>
                <th className={`${head} w-14`}>Game 1</th>
                <th className={`${head} w-14`}>Game 2</th>
                <th className={`${head} w-14`}>Totals</th>
              </Fragmentish>
            ))}
          </tr>
        </thead>

        <tbody>
          {cards.map((card) => {
            // On the paper sheet the break alternates down the sheet and
            // flips each round.
            const homeBreaks = (card.tableNumber - 1 + roundNumber - 1) % 2 === 0;
            const open = editingId === card.id;
            const tappable = card.canEdit || card.canConfirm || card.history.length > 0;
            const openEditor = () => setEditingId(open ? null : card.id);
            return (
              <Fragmentish key={card.id}>
                <tr
                  className={`${tappable ? "cursor-pointer hover:bg-neutral-50" : ""} ${
                    open ? "bg-neutral-200" : card.isMine ? "bg-neutral-50" : ""
                  }`}
                  onClick={tappable ? openEditor : undefined}
                  onKeyDown={
                    tappable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openEditor();
                          }
                        }
                      : undefined
                  }
                  tabIndex={tappable ? 0 : undefined}
                  role={tappable ? "button" : undefined}
                  title={tappable ? "Tap to enter or check this table's scores" : undefined}
                >
                  <PlayerCells
                    tableNumber={card.tableNumber}
                    name={card.homeName}
                    breaks={homeBreaks}
                    handicap={card.homeHandicap}
                    game1={card.scores.homeGame1}
                    game2={card.scores.homeGame2}
                    ero1={card.scores.homeGame1Ero}
                    ero2={card.scores.homeGame2Ero}
                    scores={card.scores}
                    status={card.status}
                    mine={card.isMine}
                  />
                  <PlayerCells
                    tableNumber={card.tableNumber}
                    name={card.awayName}
                    breaks={!homeBreaks}
                    handicap={card.awayHandicap}
                    game1={card.scores.awayGame1}
                    game2={card.scores.awayGame2}
                    ero1={card.scores.awayGame1Ero}
                    ero2={card.scores.awayGame2Ero}
                    scores={card.scores}
                    status={card.status}
                    mine={card.isMine}
                  />
                </tr>
              </Fragmentish>
            );
          })}

          <SummaryRow
            label="Score Subtotal"
            home={summary.homeSubtotal}
            away={summary.awaySubtotal}
            show={summary.played}
          />
          <SummaryRow
            label="Handicap Total"
            home={summary.homeHandicapTotal.toFixed(1)}
            away={summary.awayHandicapTotal.toFixed(1)}
            show
          />
          <SummaryRow
            label="Opponent Handicap"
            home={summary.awayHandicapTotal.toFixed(1)}
            away={summary.homeHandicapTotal.toFixed(1)}
            show
          />
          <SummaryRow
            label="Bonus over 22"
            home={summary.homeOver.toFixed(1)}
            away={summary.awayOver.toFixed(1)}
            show
          />
          <SummaryRow label="Difference" home={summary.difference.toFixed(1)} away={summary.difference.toFixed(1)} show />
          <SummaryRow label="x2" home={summary.doubled.toFixed(1)} away={summary.doubled.toFixed(1)} show />
          <SummaryRow
            label="Round  up / dn"
            home={summary.homeBonus}
            away={summary.awayBonus}
            show={summary.played}
          />
          <SummaryRow
            label={`ROUND ${roundNumber} TOTAL`}
            home={summary.homeTotal}
            away={summary.awayTotal}
            show={summary.played}
            strong
            circled={summary.played && summary.homeTotal === summary.awayTotal}
          />
        </tbody>
        </table>
      </div>

      {editingCard && (
        <div className="rounded-lg border border-neutral-300">
          <ScoreCardEditor
            card={editingCard}
            leagueId={leagueId}
            matchId={matchId}
            isManager={isManager}
            onClose={() => setEditingId(null)}
          />
        </div>
      )}
    </div>
  );
}

/** Keeps table rows valid: cells for both sides sit in the same <tr>. */
function Fragmentish({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Outcome({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="text-xs text-neutral-400">WIN / LOSS</span>;
  const style =
    outcome === "WIN"
      ? "bg-green-100 text-green-800"
      : outcome === "TIE"
        ? "bg-neutral-200 text-neutral-700"
        : "bg-neutral-100 text-neutral-500";
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${style}`}>{outcome}</span>;
}

function PlayerCells({
  tableNumber,
  name,
  breaks,
  handicap,
  game1,
  game2,
  ero1,
  ero2,
  scores,
  status,
  mine,
}: {
  tableNumber: number;
  name: string;
  breaks: boolean;
  handicap: number;
  game1: number;
  game2: number;
  ero1: boolean;
  ero2: boolean;
  scores: CardScores;
  status: CardView["status"];
  mine: boolean;
}) {
  const game1Played = scores.homeGame1 !== 0 || scores.awayGame1 !== 0;
  const game2Played = scores.homeGame2 !== 0 || scores.awayGame2 !== 0;
  const total = game1Played || game2Played ? game1 + game2 : null;
  return (
    <>
      <td className={`${cell} text-center text-[11px] text-neutral-500`}>{tableNumber}</td>
      <td className={`${cell} text-xs`}>
        <span className={mine ? "font-semibold" : ""}>{name}</span>
        <StatusDot status={status} />
      </td>
      <td className={`${cell} text-center text-[11px] text-neutral-500`}>{breaks ? "Break" : "Rack"}</td>
      <td className={number}>{handicap.toFixed(1)}</td>
      <td className={number}>
        <Score value={game1} ero={ero1} played={game1Played} />
      </td>
      <td className={number}>
        <Score value={game2} ero={ero2} played={game2Played} />
      </td>
      <td className={`${number} font-medium`}>{total === null ? "–" : total}</td>
    </>
  );
}

function Score({ value, ero, played }: { value: number; ero: boolean; played: boolean }) {
  if (!played) return <span className="text-neutral-400">–</span>;
  return (
    <span
      className={ero ? "inline-flex min-w-7 justify-center rounded-full ring-1 ring-neutral-900" : ""}
      title={ero ? "ERO" : undefined}
    >
      {value}
    </span>
  );
}

function StatusDot({ status }: { status: CardView["status"] }) {
  if (status === "EMPTY") return null;
  const confirmed = status === "CONFIRMED";
  return (
    <span
      title={confirmed ? "Confirmed" : "Entered, needs confirming"}
      className={`ml-1.5 inline-block h-2 w-2 rounded-full align-middle ${
        confirmed ? "bg-green-500" : "bg-amber-400"
      }`}
    />
  );
}

function SummaryRow({
  label,
  home,
  away,
  show,
  strong,
  circled,
}: {
  label: string;
  home: number | string;
  away: number | string;
  show: boolean;
  strong?: boolean;
  circled?: boolean;
}) {
  const value = (v: number | string) => (
    <span
      className={`${strong ? "font-bold" : ""} ${
        circled ? "inline-flex min-w-8 justify-center rounded-full ring-1 ring-neutral-900" : ""
      }`}
      title={circled ? "Tied round: half a win each" : undefined}
    >
      {show ? v : "–"}
    </span>
  );
  return (
    <tr className={strong ? "bg-neutral-50" : ""}>
      <td colSpan={6} className={`${cell} text-right text-xs ${strong ? "font-bold" : "text-neutral-600"}`}>
        {label}
      </td>
      <td className={number}>{value(home)}</td>
      <td colSpan={6} className={`${cell} text-right text-xs ${strong ? "font-bold" : "text-neutral-600"}`}>
        {label}
      </td>
      <td className={number}>{value(away)}</td>
    </tr>
  );
}
