"use client";

import { useState } from "react";
import { updateMatch } from "@/lib/actions";

interface Player {
  id: string;
  name: string;
  rating: number;
}

export default function MatchEditForm({
  leagueId,
  matchId,
  players,
  date,
  homeLabel,
  awayLabel,
  currentHomePlayerIds,
  currentAwayPlayerIds,
  hasScores,
}: {
  leagueId: string;
  matchId: string;
  players: Player[];
  date: string;
  homeLabel: string;
  awayLabel: string;
  currentHomePlayerIds: string[];
  currentAwayPlayerIds: string[];
  hasScores: boolean;
}) {
  const updateThisMatch = updateMatch.bind(null, leagueId, matchId);

  const [homePlayerIds, setHomePlayerIds] = useState<string[]>(currentHomePlayerIds);
  const [awayPlayerIds, setAwayPlayerIds] = useState<string[]>(currentAwayPlayerIds);
  const [error, setError] = useState<string | null>(null);

  function toggle(side: "home" | "away", id: string) {
    const [list, setList, otherList] =
      side === "home"
        ? ([homePlayerIds, setHomePlayerIds, awayPlayerIds] as const)
        : ([awayPlayerIds, setAwayPlayerIds, homePlayerIds] as const);

    if (list.includes(id)) {
      setList(list.filter((x) => x !== id));
      return;
    }
    if (otherList.includes(id) || list.length >= 3) return;
    setList([...list, id]);
  }

  const lineupChanged =
    [...homePlayerIds].sort().join(",") !== [...currentHomePlayerIds].sort().join(",") ||
    [...awayPlayerIds].sort().join(",") !== [...currentAwayPlayerIds].sort().join(",");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (homePlayerIds.length !== 3 || awayPlayerIds.length !== 3) {
      e.preventDefault();
      setError("Pick exactly 3 players for each side.");
      return;
    }
    setError(null);
  }

  return (
    <form action={updateThisMatch} onSubmit={handleSubmit} className="flex flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Date
        <input
          type="date"
          name="date"
          defaultValue={date}
          required
          className="rounded-md border px-3 py-2 font-normal"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Home team name (optional)
          <input
            type="text"
            name="homeLabel"
            defaultValue={homeLabel}
            placeholder="e.g. The Sharks"
            className="rounded-md border px-3 py-2 font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Away team name (optional)
          <input
            type="text"
            name="awayLabel"
            defaultValue={awayLabel}
            placeholder="e.g. The Hustlers"
            className="rounded-md border px-3 py-2 font-normal"
          />
        </label>
      </div>

      {hasScores && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          This match already has scores entered. Changing either lineup below will erase all of
          them and start the match over.
        </p>
      )}

      <PlayerPicker
        title="Home lineup (pick 3)"
        players={players}
        selected={homePlayerIds}
        disabledIds={awayPlayerIds}
        onToggle={(id) => toggle("home", id)}
        inputName="homePlayerIds"
      />

      <PlayerPicker
        title="Away lineup (pick 3)"
        players={players}
        selected={awayPlayerIds}
        disabledIds={homePlayerIds}
        onToggle={(id) => toggle("away", id)}
        inputName="awayPlayerIds"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        className="rounded-md bg-neutral-900 px-4 py-3 text-sm font-medium text-white"
      >
        {hasScores && lineupChanged ? "Save (erases current scores)" : "Save"}
      </button>
    </form>
  );
}

function PlayerPicker({
  title,
  players,
  selected,
  disabledIds,
  onToggle,
  inputName,
}: {
  title: string;
  players: Player[];
  selected: string[];
  disabledIds: string[];
  onToggle: (id: string) => void;
  inputName: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      {players.map((p) => {
        const checked = selected.includes(p.id);
        const disabled = !checked && (disabledIds.includes(p.id) || selected.length >= 3);
        return (
          <label
            key={p.id}
            className={`flex items-center gap-2 text-sm ${disabled ? "opacity-40" : ""}`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => onToggle(p.id)}
            />
            {checked && <input type="hidden" name={inputName} value={p.id} />}
            {p.name} <span className="text-neutral-400">({p.rating})</span>
          </label>
        );
      })}
    </fieldset>
  );
}
