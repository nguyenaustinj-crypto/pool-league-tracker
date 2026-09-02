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
  const maxTables = Math.floor(players.length / 2);

  const [tableCount, setTableCount] = useState(currentHomePlayerIds.length || 1);
  const [homePlayerIds, setHomePlayerIds] = useState<string[]>(currentHomePlayerIds);
  const [awayPlayerIds, setAwayPlayerIds] = useState<string[]>(currentAwayPlayerIds);
  const [error, setError] = useState<string | null>(null);

  function resize(ids: string[], count: number): string[] {
    return Array.from({ length: count }, (_, i) => ids[i] ?? "");
  }

  function changeTableCount(value: number) {
    const count = Math.max(1, Math.min(maxTables, value));
    setTableCount(count);
    setHomePlayerIds((prev) => resize(prev, count));
    setAwayPlayerIds((prev) => resize(prev, count));
  }

  function setSlot(side: "home" | "away", index: number, playerId: string) {
    const [list, setList] = side === "home" ? [homePlayerIds, setHomePlayerIds] : [awayPlayerIds, setAwayPlayerIds];
    const next = [...list];
    next[index] = playerId;
    setList(next);
  }

  const usedIds = new Set([...homePlayerIds, ...awayPlayerIds].filter(Boolean));

  function optionsFor(currentValue: string) {
    return players.filter((p) => p.id === currentValue || !usedIds.has(p.id));
  }

  const lineupChanged =
    [...homePlayerIds].sort().join(",") !== [...currentHomePlayerIds].sort().join(",") ||
    [...awayPlayerIds].sort().join(",") !== [...currentAwayPlayerIds].sort().join(",");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (homePlayerIds.some((id) => !id) || awayPlayerIds.some((id) => !id)) {
      e.preventDefault();
      setError("Pick a player for both sides of every table.");
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
          This match already has scores entered. Changing the number of tables or either
          lineup below will erase all of them and start the match over.
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium">
        How many tables?
        <input
          type="number"
          min={1}
          max={maxTables}
          value={tableCount}
          onChange={(e) => changeTableCount(Number(e.target.value) || 1)}
          className="w-24 rounded-md border px-3 py-2 font-normal"
        />
        <span className="text-xs font-normal text-neutral-500">
          {players.length} players in this league — up to {maxTables} table
          {maxTables === 1 ? "" : "s"} at once.
        </span>
      </label>

      <div className="flex flex-col gap-3">
        {Array.from({ length: tableCount }, (_, i) => (
          <fieldset key={i} className="grid grid-cols-2 gap-4 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Table {i + 1}</legend>
            <TableSlot
              label="Home player"
              value={homePlayerIds[i] ?? ""}
              options={optionsFor(homePlayerIds[i] ?? "")}
              onChange={(id) => setSlot("home", i, id)}
              inputName="homePlayerIds"
            />
            <TableSlot
              label="Away player"
              value={awayPlayerIds[i] ?? ""}
              options={optionsFor(awayPlayerIds[i] ?? "")}
              onChange={(id) => setSlot("away", i, id)}
              inputName="awayPlayerIds"
            />
          </fieldset>
        ))}
      </div>

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

function TableSlot({
  label,
  value,
  options,
  onChange,
  inputName,
}: {
  label: string;
  value: string;
  options: Player[];
  onChange: (id: string) => void;
  inputName: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-normal text-neutral-600">
      {label}
      <select
        name={inputName}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border px-3 py-2"
      >
        <option value="" disabled>
          Select a player
        </option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.rating})
          </option>
        ))}
      </select>
    </label>
  );
}
