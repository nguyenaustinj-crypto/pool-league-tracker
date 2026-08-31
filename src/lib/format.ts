// A match's side has an optional free-text label (mirrors the paper sheet's
// blank team-name field). When none was given, fall back to listing the
// side's player names instead.
export function sideLabel(label: string | null, playerNames: string[]): string {
  return label || playerNames.join(" / ");
}
