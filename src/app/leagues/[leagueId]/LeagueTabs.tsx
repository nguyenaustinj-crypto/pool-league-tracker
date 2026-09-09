import Link from "next/link";

const tabs = [
  { key: "standings", label: "Standings" },
  { key: "teams", label: "Teams" },
  { key: "matches", label: "Matches" },
] as const;

export default function LeagueTabs({
  leagueId,
  active,
}: {
  leagueId: string;
  active: (typeof tabs)[number]["key"];
}) {
  return (
    <nav className="flex gap-1 border-b">
      {tabs.map((tab) => {
        const href =
          tab.key === "standings" ? `/leagues/${leagueId}` : `/leagues/${leagueId}/${tab.key}`;
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              isActive
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
