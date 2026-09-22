// TEMPORARY (remove once production has deployed successfully).
//
// On 2026-09-19 the migration below failed part-way against the production
// database, and Prisma then refused to apply any later migration ("P3009:
// migrate found failed migrations in the target database"). This marks that
// migration as settled so deploys can continue; the follow-up migration
// 20260922010000_repair_score_cards puts in whatever it didn't create, and
// skips anything already there.
//
// Runs as part of `npm run build`, which is where the production database's
// credentials live (in Vercel), so nobody has to copy them anywhere. Does
// nothing on a database where that migration is already recorded.

import { spawnSync } from "node:child_process";

const MIGRATION = "20260919002245_roster_links_and_score_cards";

const result = spawnSync(
  "npx",
  ["prisma", "migrate", "resolve", "--applied", MIGRATION],
  { stdio: "inherit", shell: true }
);

if (result.status === 0) {
  console.log(`Marked ${MIGRATION} as applied so deploys can continue.`);
} else {
  console.log(`No repair needed for ${MIGRATION}.`);
}
