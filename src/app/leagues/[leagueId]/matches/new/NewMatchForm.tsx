"use client";

import { useState } from "react";
import { createMatch } from "@/lib/actions";

interface Player {
  id: string;
  name: string;
  rating: number;
}

interface Team {
  id: string;
  name: string;
  players: Player[];
}

export default function NewMatchForm({ leagueId, teams }: { leagueId: string; teams: Team[] }) {
  const createMatchInLeague = createMatch.bind(null, leagueId);

  const [homeTeamId, setHomeTeamId] = useState(teams[0]?.id ?? "");
  const [awayTeamId, setAwayTeamId] = useState(
    teams.find((t) => t.id !== teams[0]?.id)?.id ?? ""
  );

  const homeTeam = teams.find((t) => t.id === homeTeamId);
  const awayTeam = teams.find((t) => t.id === awayTeamId);
  const maxTables = Math.min(homeTeam?.players.length ?? 0, awayTeam?.players.length ?? 0);

  const [tableCount, setTableCount] = useState(Math.min(3, maxTables) || 1);
  const [homePlayerIds, setHomePlayerIds] = useState<string[]>(Array(tableCount).fill(""));
  const [awayPlayerIds, setAwayPlayerIds] = useState<string[]>(Array(tableCount).fill(""));
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

  function changeTeam(side: "home" | "away", teamId: string) {
    if (side === "home") setHomeTeamId(teamId);
    else setAwayTeamId(teamId);
    // Player pools just changed, so any picks made for that side no longer apply.
    if (side === "home") setHomePlayerIds(Array(tableCount).fill(""));
    else setAwayPlayerIds(Array(tableCount).fill(""));
  }

  function setSlot(side: "home" | "away", index: number, playerId: string) {
    const [list, setList] = side === "home" ? [homePlayerIds, setHomePlayerIds] : [awayPlayerIds, setAwayPlayerIds];
    const next = [...list];
    next[index] = playerId;
    setList(next);
  }

  function optionsFor(pool: Player[], picked: string[], currentValue: string) {
    const used = new Set(picked.filter(Boolean));
    return pool.filter((p) => p.id === currentValue || !used.has(p.id));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) {
      e.preventDefault();
      setError("Pick two different teams.");
      return;
    }
    if (homePlayerIds.some((id) => !id) || awayPlayerIds.some((id) => !id)) {
      e.preventDefault();
      setError("Pick a player for both sides of every table.");
      return;
    }
    setError(null);
  }

  return (
    <form action={createMatchInLeague} onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Home team
          <select
            name="homeTeamId"
            required
            value={homeTeamId}
            onChange={(e) => changeTeam("home", e.target.value)}
            className="rounded-md border px-3 py-2 font-normal"
          >
            <option value="" disabled>
              Select a team
            </option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Away team
          <select
            name="awayTeamId"
            required
            value={awayTeamId}
            onChange={(e) => changeTeam("away", e.target.value)}
            className="rounded-md border px-3 py-2 font-normal"
          >
            <option value="" disabled>
              Select a team
            </option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        How many tables?
        <input
          type="number"
          min={1}
          max={maxTables || 1}
          value={tableCount}
          onChange={(e) => changeTableCount(Number(e.target.value) || 1)}
          disabled={maxTables === 0}
          className="w-24 rounded-md border px-3 py-2 font-normal"
        />
        <span className="text-xs font-normal text-neutral-500">
          {maxTables === 0
            ? "Both teams need at least 1 player to start a match."
            : `Up to ${maxTables} table${maxTables === 1 ? "" : "s"} at once, limited by the smaller team's roster.`}
        </span>
      </label>

      <div className="flex flex-col gap-3">
        {Array.from({ length: maxTables === 0 ? 0 : tableCount }, (_, i) => (
          <fieldset key={i} className="grid grid-cols-2 gap-4 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Table {i + 1}</legend>
            <TableSlot
              label={`Home player (${homeTeam?.name ?? ""})`}
              value={homePlayerIds[i] ?? ""}
              options={optionsFor(homeTeam?.players ?? [], homePlayerIds, homePlayerIds[i] ?? "")}
              onChange={(id) => setSlot("home", i, id)}
              inputName="homePlayerIds"
            />
            <TableSlot
              label={`Away player (${awayTeam?.name ?? ""})`}
              value={awayPlayerIds[i] ?? ""}
              options={optionsFor(awayTeam?.players ?? [], awayPlayerIds, awayPlayerIds[i] ?? "")}
              onChange={(id) => setSlot("away", i, id)}
              inputName="awayPlayerIds"
            />
          </fieldset>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={maxTables === 0}
        className="rounded-md bg-neutral-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
      >
        Start Match
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
