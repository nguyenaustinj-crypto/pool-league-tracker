// A plain GET form, so searching works even before the page's JavaScript
// loads. Results live at /leagues/search?q=...
export default function LeagueSearchForm({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/leagues/search" role="search" className="flex flex-col gap-2 sm:flex-row">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="League name"
        aria-label="League name"
        required
        minLength={2}
        className="flex-1 rounded-md border px-3 py-2"
      />
      <button
        type="submit"
        className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
      >
        Search
      </button>
    </form>
  );
}
