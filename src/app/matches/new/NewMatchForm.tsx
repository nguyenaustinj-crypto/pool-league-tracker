"use client";

import { useMemo, useState } from "react";
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

export default function NewMatchForm({ teams }: { teams: Team[] }) {
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [homePlayerIds, setHomePlayerIds] = useState<string[]>([]);
  const [awayPlayerIds, setAwayPlayerIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const homeTeam = useMemo(() => teams.find((t) => t.id === homeTeamId), [teams, homeTeamId]);
  const awayTeam = useMemo(() => teams.find((t) => t.id === awayTeamId), [teams, awayTeamId]);

  function togglePlayer(list: string[], setList: (ids: string[]) => void, id: string) {
    if (list.includes(id)) {
      setList(list.filter((x) => x !== id));
    } else if (list.length < 3) {
      setList([...list, id]);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!homeTeamId || !awayTeamId) {
      e.preventDefault();
      setError("Pick both a home and away team.");
      return;
    }
    if (homeTeamId === awayTeamId) {
      e.preventDefault();
      setError("Home and away teams must be different.");
      return;
    }
    if (homePlayerIds.length !== 3 || awayPlayerIds.length !== 3) {
      e.preventDefault();
      setError("Pick exactly 3 players from each team's roster for this match.");
      return;
    }
    setError(null);
  }

  return (
    <form action={createMatch} onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <TeamPicker
          label="Home team"
          teams={teams}
          value={homeTeamId}
          exclude={awayTeamId}
          onChange={(id) => {
            setHomeTeamId(id);
            setHomePlayerIds([]);
          }}
          inputName="homeTeamId"
        />
        <TeamPicker
          label="Away team"
          teams={teams}
          value={awayTeamId}
          exclude={homeTeamId}
          onChange={(id) => {
            setAwayTeamId(id);
            setAwayPlayerIds([]);
          }}
          inputName="awayTeamId"
        />
      </div>

      {homeTeam && (
        <PlayerPicker
          title={`${homeTeam.name} lineup (pick 3)`}
          players={homeTeam.players}
          selected={homePlayerIds}
          onToggle={(id) => togglePlayer(homePlayerIds, setHomePlayerIds, id)}
          inputName="homePlayerIds"
        />
      )}

      {awayTeam && (
        <PlayerPicker
          title={`${awayTeam.name} lineup (pick 3)`}
          players={awayTeam.players}
          selected={awayPlayerIds}
          onToggle={(id) => togglePlayer(awayPlayerIds, setAwayPlayerIds, id)}
          inputName="awayPlayerIds"
        />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        className="rounded-md bg-neutral-900 px-4 py-3 text-sm font-medium text-white"
      >
        Start Match
      </button>
    </form>
  );
}

function TeamPicker({
  label,
  teams,
  value,
  exclude,
  onChange,
  inputName,
}: {
  label: string;
  teams: Team[];
  value: string;
  exclude: string;
  onChange: (id: string) => void;
  inputName: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <select
        name={inputName}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border px-3 py-2"
      >
        <option value="" disabled>
          Select a team
        </option>
        {teams
          .filter((t) => t.id !== exclude)
          .map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
      </select>
    </label>
  );
}

function PlayerPicker({
  title,
  players,
  selected,
  onToggle,
  inputName,
}: {
  title: string;
  players: Player[];
  selected: string[];
  onToggle: (id: string) => void;
  inputName: string;
}) {
  if (players.length === 0) {
    return <p className="text-sm text-neutral-500">{title}: this team has no players yet.</p>;
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      {players.map((p) => {
        const checked = selected.includes(p.id);
        return (
          <label key={p.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(p.id)}
              disabled={!checked && selected.length >= 3}
            />
            {checked && <input type="hidden" name={inputName} value={p.id} />}
            {p.name} <span className="text-neutral-400">({p.rating})</span>
          </label>
        );
      })}
    </fieldset>
  );
}
