import Link from "next/link";

const tabs = [
  { key: "standings", label: "Standings", managersOnly: false },
  { key: "teams", label: "Teams", managersOnly: false },
  { key: "matches", label: "Matches", managersOnly: false },
  { key: "members", label: "Members", managersOnly: true },
] as const;

export default function LeagueTabs({
  leagueId,
  active,
  canManage,
}: {
  leagueId: string;
  active: (typeof tabs)[number]["key"];
  canManage: boolean;
}) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b">
      {tabs
        .filter((tab) => canManage || !tab.managersOnly)
        .map((tab) => {
          const href =
            tab.key === "standings" ? `/leagues/${leagueId}` : `/leagues/${leagueId}/${tab.key}`;
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={href}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
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
