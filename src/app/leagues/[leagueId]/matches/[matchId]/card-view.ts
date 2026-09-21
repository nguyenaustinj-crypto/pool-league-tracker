import type { CardScores, CardStatus } from "@/lib/score-entry";

/** One table in one round, as the match page hands it to the browser. */
export interface CardView {
  id: string;
  /** Which table this is on the sheet, 1..N. */
  tableNumber: number;
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
  history: {
    id: string;
    who: string;
    when: string;
    before: string;
    after: string;
    note: string | null;
  }[];
}
